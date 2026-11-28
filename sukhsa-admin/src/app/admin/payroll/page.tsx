import Link from "next/link";
import type { Metadata } from "next";
import { Download, IndianRupee, Lock, Users, Clock, CalendarCheck, TriangleAlert, MessageSquareWarning } from "lucide-react";
import { auth } from "@/auth";
import { monthlyPayroll } from "@/lib/services/payroll";
import { allowedActions } from "@/lib/services/payroll-runs";
import { currentMonthIST, fmtRate, fmtRupees, isValidMonth } from "@/lib/dates";
import { Badge, Card, EmptyState, MonthPicker, PageHeader, StatCard, btn, table } from "@/components/ui/ui";
import { PayrollWorkflow } from "@/components/admin/PayrollWorkflow";
import { RunStatus, stampText } from "@/components/admin/RunStatus";

export const metadata: Metadata = { title: "Payroll · Sukhsa Exports Admin" };

type SP = { month?: string; category?: string; worked?: string };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonthIST();
  const category = sp.category === "permanent" || sp.category === "temporary" ? sp.category : undefined;
  const onlyWorked = sp.worked === "1";
  const [p, session] = await Promise.all([monthlyPayroll(month, category), auth()]);
  // Approval always covers the whole month (both categories), even when a tab filter is on.
  const full = category ? await monthlyPayroll(month) : p;
  const run = p.run;
  const actions = session?.user?.role ? allowedActions(run.status, session.user.role) : [];
  const rows = onlyWorked ? p.rows.filter((r) => r.days > 0) : p.rows;

  const tab = (label: string, c?: string) => {
    const q = new URLSearchParams(Object.entries({ month, category: c, worked: sp.worked }).filter(([, v]) => v) as [string, string][]);
    const on = (c ?? "") === (category ?? "");
    return (
      <Link key={label} href={`/admin/payroll?${q}`} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-ink text-bg" : "bg-surface-2 text-ink-soft hover:text-ink"}`}>
        {label}
      </Link>
    );
  };
  const csv = `/api/v1/payroll/${month}?format=csv${category ? `&category=${category}` : ""}`;
  const workedHref = `/admin/payroll?${new URLSearchParams(Object.entries({ month, category, worked: onlyWorked ? undefined : "1" }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="animate-rise">
      <PageHeader
        title="Payroll"
        subtitle={<>Payable = (Working − Theka) × Rate · same columns as the master sheet</>}
        actions={
          <>
            <MonthPicker month={month} basePath="/admin/payroll" params={{ category, worked: sp.worked }} />
            <a href={csv} className={btn.secondary}>
              <Download className="size-4" /> Excel (CSV)
            </a>
          </>
        }
      />

      {/* Approval status for the month */}
      <Card className="mb-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-ink">{p.label} payroll</span>
              <RunStatus status={run.status} />
              {run.frozen && <Badge><Lock className="size-3" /> Attendance frozen</Badge>}
            </div>
            <div className="space-y-0.5 text-xs text-ink-faint">
              {[stampText("Submitted", run.submitted), stampText("Approved", run.approved), stampText("Paid", run.paid)].filter(Boolean).map((t) => (
                <div key={t}>{t}</div>
              ))}
              {run.status === "draft" && <div>Accounts prepares the month, then submits it to the CEO for approval.</div>}
            </div>
            {run.note && (run.status === "rejected" || run.status === "draft") && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                <MessageSquareWarning className="mt-0.5 size-4 shrink-0" /> CEO note: {run.note}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <PayrollWorkflow month={month} label={p.label} actions={actions} total={fmtRupees(full.totals.payableAmount)} />
          </div>
        </div>
      </Card>
      {p.totals.openShifts > 0 && (
        <Link href={`/admin/attendance?month=${month}&status=open`} className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-500/5 px-4 py-3 text-sm text-ink">
          <TriangleAlert className="size-4 text-red-600" /> {p.totals.openShifts} shift(s) without an Out time are not counted. Fix them in Attendance.
        </Link>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} label="Total net payable" value={fmtRupees(p.totals.payableAmount)} />
        <StatCard icon={Clock} label="Working hours" value={p.totals.workingHours} hint={`Theka ${p.totals.thekaHours} h`} tone="ink" />
        <StatCard icon={CalendarCheck} label="Present days (P)" value={p.totals.presentDays} hint={`Normal hours ${p.totals.normalHours} h`} tone="accent" />
        <StatCard icon={Users} label="Staff on sheet" value={p.totals.employees} hint={`${p.rows.filter((r) => r.days > 0).length} worked this month`} tone="ink" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="flex flex-wrap gap-1.5">
            {tab("All")}
            {tab("Permanent", "permanent")}
            {tab("Temporary", "temporary")}
          </div>
          <Link href={workedHref} className="text-xs font-semibold text-brand">
            {onlyWorked ? "Show everyone" : "Only staff who worked"}
          </Link>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={IndianRupee} title="No staff to show" />
        ) : (
          <div className={table.wrap}>
            <table className={`${table.table} min-w-[960px]`}>
              <thead>
                <tr>
                  <th className={table.th}>Employee ID</th>
                  <th className={table.th}>Name</th>
                  <th className={table.th}>Department</th>
                  <th className={table.thNum}>Rate</th>
                  <th className={table.thNum}>Working hrs</th>
                  <th className={table.thNum}>Present (P)</th>
                  <th className={table.thNum}>Theka (H)</th>
                  <th className={table.thNum}>Normal (H)</th>
                  <th className={table.thNum}>Net payable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId} className={`${table.row} ${r.days === 0 ? "opacity-60" : ""}`}>
                    <td className={table.td}>{r.empCode}</td>
                    <td className={table.tdStrong}>
                      <Link href={`/admin/employees/${r.employeeId}?month=${month}`} className="hover:text-brand">{r.name}</Link>
                      {r.openShifts > 0 && <span className="ml-2"><Badge tone="red">{r.openShifts} open</Badge></span>}
                    </td>
                    <td className={table.td}>{r.department || "—"}</td>
                    <td className={table.num}>{fmtRate(r.hourlyRate)}</td>
                    <td className={table.num}>{r.workingHours.toFixed(2)}</td>
                    <td className={table.num}>{r.presentDays}</td>
                    <td className={table.num}>{r.thekaHours.toFixed(2)}</td>
                    <td className={table.num}>{r.normalHours.toFixed(2)}</td>
                    <td className={table.num}><b>{fmtRupees(r.payableAmount)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2/60">
                  <td className={table.tdStrong}>TOTAL</td>
                  <td className={table.tdStrong}>{p.totals.employees} staff</td>
                  <td className={table.td} colSpan={2} />
                  <td className={table.num}><b>{p.totals.workingHours.toFixed(2)}</b></td>
                  <td className={table.num}><b>{p.totals.presentDays}</b></td>
                  <td className={table.num}><b>{p.totals.thekaHours.toFixed(2)}</b></td>
                  <td className={table.num}><b>{p.totals.normalHours.toFixed(2)}</b></td>
                  <td className={table.num}><b>{fmtRupees(p.totals.payableAmount)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
