import "server-only";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type PayrollRun, type PayrollRunStatus } from "@/lib/schema";
import { ApiError } from "@/lib/api/errors";
import { monthLabel } from "@/lib/dates";

/** Statuses in which a month's attendance and Theka can no longer change. */
export const FROZEN: PayrollRunStatus[] = ["submitted", "approved", "paid"];

export const STATUS_LABEL: Record<PayrollRunStatus, string> = {
  draft: "Draft",
  submitted: "Waiting for approval",
  rejected: "Sent back",
  approved: "Approved",
  paid: "Paid",
};

export async function getRun(month: string): Promise<PayrollRun | null> {
  const db = await getDb();
  return db.collection<PayrollRun>(COLLECTIONS.payrollRuns).findOne({ _id: month });
}

/** The month's run if it is frozen (submitted / approved / paid), otherwise null. */
export async function getLock(month: string): Promise<PayrollRun | null> {
  const run = await getRun(month);
  return run && FROZEN.includes(run.status) ? run : null;
}

/** Block changes to a month that is waiting for approval, approved or paid. */
export async function assertMonthOpen(month: string) {
  const run = await getLock(month);
  if (run) {
    const why =
      run.status === "submitted"
        ? "is waiting for the CEO's approval. Ask the Super Admin to send it back if something must change."
        : `is ${STATUS_LABEL[run.status].toLowerCase()}. Only the Super Admin can reopen it.`;
    throw new ApiError(423, `${monthLabel(month)} payroll ${why}`);
  }
}
