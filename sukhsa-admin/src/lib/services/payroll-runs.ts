import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type PayrollRun, type PayrollRunStatus } from "@/lib/schema";
import { ApiError, type Actor } from "@/lib/api/errors";
import { monthLabel } from "@/lib/dates";
import { monthlyPayroll } from "./payroll";
import { logChange } from "./audit";
import { STATUS_LABEL } from "./locks";

export const runAction = z.object({
  action: z.enum(["submit", "approve", "reject", "mark_paid", "reopen"]),
  note: z.string().trim().max(500).optional(),
});
export type RunAction = z.infer<typeof runAction>["action"];

/** Who may do what, from which status. */
const RULES: Record<RunAction, { from: PayrollRunStatus[]; to: PayrollRunStatus; roles: Actor["role"][]; needsNote?: boolean }> = {
  submit: { from: ["draft", "rejected"], to: "submitted", roles: ["admin", "super_admin"] },
  approve: { from: ["submitted"], to: "approved", roles: ["super_admin"] },
  reject: { from: ["submitted"], to: "rejected", roles: ["super_admin"], needsNote: true },
  mark_paid: { from: ["approved"], to: "paid", roles: ["admin", "super_admin"] },
  reopen: { from: ["submitted", "approved", "paid"], to: "draft", roles: ["super_admin"], needsNote: true },
};

/** What the signed-in person can do next on this month (drives the buttons). */
export function allowedActions(status: PayrollRunStatus, role: Actor["role"]): RunAction[] {
  return (Object.keys(RULES) as RunAction[]).filter((a) => RULES[a].from.includes(status) && RULES[a].roles.includes(role));
}

export async function transitionRun(month: string, action: RunAction, note: string | undefined, actor: Actor) {
  const rule = RULES[action];
  if (!rule.roles.includes(actor.role)) {
    throw new ApiError(403, action === "approve" || action === "reject" || action === "reopen" ? "Only the Super Admin (CEO) can do this" : "Your role can't do this");
  }
  if (rule.needsNote && !note) throw new ApiError(400, "Please add a note explaining why");

  const db = await getDb();
  const col = db.collection<PayrollRun>(COLLECTIONS.payrollRuns);
  const current = (await col.findOne({ _id: month }))?.status ?? "draft";
  if (!rule.from.includes(current)) {
    const verb: Record<RunAction, string> = { submit: "submitted", approve: "approved", reject: "sent back", mark_paid: "marked as paid", reopen: "reopened" };
    throw new ApiError(409, `${monthLabel(month)} is "${STATUS_LABEL[current]}", so it can't be ${verb[action]} now`);
  }

  const p = await monthlyPayroll(month);
  if (action === "submit") {
    if (p.totals.openShifts > 0) throw new ApiError(400, `${p.totals.openShifts} shift(s) in ${monthLabel(month)} have no Out time. Fix them in Attendance before submitting.`);
    if (p.totals.payableAmount <= 0) throw new ApiError(400, `Nothing is payable in ${monthLabel(month)}`);
  }
  const stamp = { by: actor.email, at: new Date(), total: p.totals.payableAmount, employees: p.rows.filter((r) => r.days > 0).length };
  const set: Partial<PayrollRun> = { status: rule.to, updatedAt: new Date(), note: note ?? null };
  if (action === "submit") Object.assign(set, { submitted: stamp, approved: null, paid: null });
  if (action === "approve") {
    const submittedTotal = (await col.findOne({ _id: month }))?.submitted?.total;
    if (submittedTotal !== undefined && Math.abs(submittedTotal - p.totals.payableAmount) > 0.005) {
      throw new ApiError(409, "The totals changed after submission. Send it back so the Admin can re-check and submit again.");
    }
    set.approved = stamp;
  }
  if (action === "mark_paid") set.paid = stamp;
  if (action === "reopen") Object.assign(set, { approved: null, paid: null });

  await col.updateOne(
    { _id: month },
    {
      $set: set,
      $push: { events: { action, by: actor.email, role: actor.role, at: new Date(), note: note ?? null, total: p.totals.payableAmount } },
    },
    { upsert: true },
  );
  await logChange(actor, {
    action: `payroll.${action}`,
    entity: "payroll",
    entityId: month,
    reason: note,
    changes: { status: { from: current, to: rule.to }, "total ₹": { from: null, to: p.totals.payableAmount } },
  });
  return db.collection<PayrollRun>(COLLECTIONS.payrollRuns).findOne({ _id: month });
}

export async function listRuns(filter: { status?: PayrollRunStatus[]; limit?: number } = {}) {
  const db = await getDb();
  const q = filter.status ? { status: { $in: filter.status } } : {};
  return db.collection<PayrollRun>(COLLECTIONS.payrollRuns).find(q).sort({ _id: -1 }).limit(filter.limit ?? 24).toArray();
}
