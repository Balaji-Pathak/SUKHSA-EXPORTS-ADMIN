import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { listRuns, allowedActions } from "@/lib/services/payroll-runs";
import { monthLabel, fmtRupees } from "@/lib/dates";
import { Card, CardHeader, EmptyState, PageHeader, btn, table } from "@/components/ui/ui";
import { PayrollWorkflow } from "@/components/admin/PayrollWorkflow";
import { RunStatus } from "@/components/admin/RunStatus";

export const metadata: Metadata = { title: "Approvals · Sukhsa Exports" };
export const dynamic = "force-dynamic";

const when = (d?: Date | string | null) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—");

export default async function ApprovalsPage() {
  const [pending, all] = await Promise.all([listRuns({ status: ["submitted"] }), listRuns({ limit: 24 })]);
  const history = all.filter((r) => r.status !== "submitted");

  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="Payroll approvals" subtitle="Accounts submits each month; you approve it for payment or send it back with a note." />

      <Card>
        <CardHeader title={`Waiting for you (${pending.length})`} />
        {pending.length === 0 ? (
          <EmptyState icon={BadgeCheck} title="Nothing to approve">When Accounts submits a month, it appears here.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((r) => (
              <li key={r._id} className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-lg font-bold text-ink">{monthLabel(r._id)}</div>
                  <div className="mt-0.5 text-sm text-ink-soft">
                    <b className="text-ink">{fmtRupees(r.submitted?.total ?? 0)}</b> for {r.submitted?.employees ?? 0} staff · submitted by {r.submitted?.by} · {when(r.submitted?.at)}
                  </div>
                  {r.note && <div className="mt-1 text-sm text-ink-soft">Note from Accounts: {r.note}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/payroll?month=${r._id}`} className={btn.secondary}>View details</Link>
                  <PayrollWorkflow month={r._id} label={monthLabel(r._id)} actions={allowedActions("submitted", "super_admin").filter((a) => a !== "reopen")} total={fmtRupees(r.submitted?.total ?? 0)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="History" />
        {history.length === 0 ? (
          <EmptyState icon={BadgeCheck} title="No decisions yet" />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Month</th>
                  <th className={table.th}>Status</th>
                  <th className={table.thNum}>Amount</th>
                  <th className={table.th}>Approved</th>
                  <th className={table.th}>Paid</th>
                  <th className={table.th} />
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r._id} className={table.row}>
                    <td className={table.tdStrong}>{monthLabel(r._id)}</td>
                    <td className={table.td}><RunStatus status={r.status} /></td>
                    <td className={table.num}>{fmtRupees(r.approved?.total ?? r.submitted?.total ?? 0)}</td>
                    <td className={table.td}>{when(r.approved?.at)}</td>
                    <td className={table.td}>{when(r.paid?.at)}</td>
                    <td className={`${table.td} text-right`}>
                      <Link href={`/admin/payroll?month=${r._id}`} className={btn.ghost}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
