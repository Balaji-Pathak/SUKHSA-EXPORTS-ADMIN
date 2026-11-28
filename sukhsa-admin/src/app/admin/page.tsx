import Link from "next/link";
import type { Metadata } from "next";
import { Users, CalendarCheck, IndianRupee, Clock, TriangleAlert, Lock, ArrowRight, CalendarX } from "lucide-react";
import { auth } from "@/auth";
import { getOverview } from "@/lib/services/overview";
import { currentMonthIST, dayLabel, fmtRupees, isValidMonth, monthLabel, fmtMinutes } from "@/lib/dates";
import { Badge, Card, CardHeader, EmptyState, MonthPicker, PageHeader, StatCard, table } from "@/components/ui/ui";

export const metadata: Metadata = { title: "Overview · Sukhsa Exports Admin" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Overview({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonthIST();
  const [o, session] = await Promise.all([getOverview(month), auth()]);
  const first = (session?.user?.name ?? session?.user?.email ?? "").split(/[\s@]/)[0];
  const noData = o.month_.records === 0;

  return (
    <div className="animate-rise">
      <PageHeader
        title={`${greeting()}, ${first}`}
        subtitle={<>Here&apos;s Sukhsa Exports for {monthLabel(month)}.</>}
        actions={<MonthPicker month={month} basePath="/admin" />}
      />

      {noData && o.latestMonthWithData && o.latestMonthWithData !== month && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-ink">
          <span>No attendance recorded in {monthLabel(month)} yet.</span>
          <Link href={`/admin?month=${o.latestMonthWithData}`} className="inline-flex items-center gap-1 font-semibold text-accent">
            Show {monthLabel(o.latestMonthWithData)} <ArrowRight className="size-4" />
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Active employees" value={o.employees.active} hint={`${o.employees.permanent} permanent · ${o.employees.temporary} temporary`} />
        <StatCard icon={Clock} label="Today" value={o.today_.records} hint={o.today_.records ? `${o.today_.stillIn} still inside` : "No one has checked in yet"} tone="ink" />
        <StatCard icon={CalendarCheck} label="Present days" value={o.month_.presentDays} hint={`${o.month_.workingHours} working hours · ${o.month_.employeesWorked} staff`} tone="accent" />
        <StatCard
          icon={IndianRupee}
          label="Payroll this month"
          value={fmtRupees(o.month_.payable)}
          hint={<Link href={`/admin/payroll?month=${month}`} className="inline-flex items-center gap-1 font-semibold text-brand">{o.month_.statusLabel} <ArrowRight className="size-3" /></Link>}
        />
      </div>

      {(o.alerts.openShiftsBeforeToday > 0 || o.alerts.shortShiftsThisMonth > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {o.alerts.openShiftsBeforeToday > 0 && (
            <Link href="/admin/attendance?status=open" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-500/5 px-4 py-3 text-sm transition hover:bg-red-500/10">
              <TriangleAlert className="size-5 text-red-600" />
              <span className="text-ink"><b>{o.alerts.openShiftsBeforeToday}</b> shift(s) from earlier days have no Out time</span>
            </Link>
          )}
          {o.alerts.shortShiftsThisMonth > 0 && (
            <Link href={`/admin/attendance?month=${month}&status=short_shift`} className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm transition hover:opacity-90">
              <CalendarX className="size-5 text-accent" />
              <span className="text-ink"><b>{o.alerts.shortShiftsThisMonth}</b> short shift(s) under 8 hours this month</span>
            </Link>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Recent attendance" action={<Link href={`/admin/attendance?month=${month}`} className="text-xs font-semibold text-brand">View all</Link>} />
          {o.recent.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No attendance this month" />
          ) : (
            <div className={table.wrap}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th className={table.th}>Date</th>
                    <th className={table.th}>Employee</th>
                    <th className={table.th}>In – Out</th>
                    <th className={table.thNum}>Net</th>
                    <th className={table.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {o.recent.map((r) => (
                    <tr key={r._id} className={table.row}>
                      <td className={table.td}>{dayLabel(r.date)}</td>
                      <td className={table.tdStrong}>
                        {r.name} <span className="font-normal text-ink-faint">· {r.empCode}</span>
                      </td>
                      <td className={table.td}>{r.inTime} – {r.outTime ?? "…"}</td>
                      <td className={table.num}>{r.calc ? fmtMinutes(r.calc.netMinutes) : "—"}</td>
                      <td className={table.td}>
                        {r.status === "open" ? <Badge tone="blue">Inside</Badge> : r.calc?.presentDays ? <Badge tone="green">Present</Badge> : <Badge tone="amber">Short</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Highest payroll this month" action={<Link href={`/admin/payroll?month=${month}`} className="text-xs font-semibold text-brand">Open payroll</Link>} />
          {o.topEarners.length === 0 ? (
            <EmptyState icon={IndianRupee} title="Nothing payable yet" />
          ) : (
            <ul className="divide-y divide-line">
              {o.topEarners.map((r) => (
                <li key={r.employeeId}>
                  <Link href={`/admin/employees/${r.employeeId}`} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-surface-2/50">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{r.name}</span>
                      <span className="text-xs text-ink-faint">
                        {r.empCode} · {r.workingHours} h · {r.presentDays} P
                      </span>
                    </span>
                    <span className="font-bold tabular-nums text-ink">{fmtRupees(r.payableAmount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
