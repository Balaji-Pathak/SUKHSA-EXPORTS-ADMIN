import { History } from "lucide-react";
import type { AuditEntry } from "@/lib/schema";
import { EmptyState } from "@/components/ui/ui";

const ACTION_LABEL: Record<string, string> = {
  "employee.create": "Added employee",
  "employee.update": "Edited employee",
  "employee.deactivate": "Deactivated employee",
  "employee.reactivate": "Reactivated employee",
  "employee.delete": "Deleted employee permanently",
  "gate.in": "Gate: marked IN",
  "gate.pause": "Gate: started break",
  "gate.resume": "Gate: ended break",
  "gate.out": "Gate: marked OUT",
  "guard.create": "Added guard login",
  "guard.update": "Changed guard login",
  "guard.delete": "Deleted guard login",
  "theka.set": "Set Theka",
  "attendance.create": "Added attendance",
  "attendance.correct": "Corrected attendance",
  "attendance.delete": "Deleted attendance",
  "payroll.submit": "Submitted payroll for approval",
  "payroll.approve": "Approved payroll",
  "payroll.reject": "Sent payroll back",
  "payroll.mark_paid": "Marked payroll as paid",
  "payroll.reopen": "Reopened payroll month",
  "team.set": "Changed supervisor team",
  "payroll.lock": "Locked payroll month",
  "payroll.unlock": "Unlocked payroll month",
  "user.add": "Added user",
  "user.update": "Changed user",
};

const fmtVal = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return Array.isArray(v) ? v.join(", ") : "…";
  return String(v);
};

/** Who changed what and when. */
export function AuditList({ entries, showEntity = false }: { entries: AuditEntry[]; showEntity?: boolean }) {
  if (!entries.length) return <EmptyState icon={History} title="No changes recorded yet" />;
  return (
    <ul className="divide-y divide-line">
      {entries.map((e) => {
        const changes = Object.entries(e.changes ?? {}).filter(([, c]) => typeof c.to !== "object" || c.to === null);
        return (
          <li key={String(e._id)} className="px-5 py-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-ink">
                {ACTION_LABEL[e.action] ?? e.action}
                {showEntity && <span className="font-normal text-ink-faint"> · {e.entityId}</span>}
              </span>
              <span className="text-xs text-ink-faint">
                {new Date(e.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} · {e.actor.email}
              </span>
            </div>
            {e.reason && <div className="mt-1 text-sm text-ink-soft">Reason: {e.reason}</div>}
            {changes.length > 0 && e.action !== "employee.create" && e.action !== "attendance.create" && e.action !== "user.add" && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {changes.slice(0, 8).map(([k, c]) => (
                  <li key={k} className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-ink-soft">
                    <b className="text-ink">{k}</b>: {fmtVal(c.from)} → {fmtVal(c.to)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
