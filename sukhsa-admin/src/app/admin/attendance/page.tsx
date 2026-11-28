import Link from "next/link";
import type { Metadata } from "next";
import { CalendarCheck, Lock } from "lucide-react";
import { listAttendance } from "@/lib/services/attendance";
import { listEmployees } from "@/lib/services/employees";
import { getLock } from "@/lib/services/locks";
import { currentMonthIST, dayLabel, fmtMinutes, isValidMonth, monthLabel, todayIST } from "@/lib/dates";
import { Badge, Card, EmptyState, MonthPicker, PageHeader, field, table } from "@/components/ui/ui";
import { AddAttendance, EditAttendance } from "@/components/admin/AttendanceDialog";

export const metadata: Metadata = { title: "Attendance · Sukhsa Exports Admin" };

type SP = { month?: string; employeeId?: string; status?: string };
const STATUSES = { open: "Inside / no Out", completed: "Present", short_shift: "Short shift" } as const;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const status = sp.status && sp.status in STATUSES ? (sp.status as keyof typeof STATUSES) : undefined;
  // "Open shifts" from the Overview alert look across all months.
  const month = isValidMonth(sp.month) ? sp.month : status === "open" ? undefined : currentMonthIST();
  const [records, employees, lock] = await Promise.all([
    listAttendance({ month, employeeId: sp.employeeId || undefined, status }),
    listEmployees({}),
    month ? getLock(month) : Promise.resolve(null),
  ]);
  const names = new Map(employees.map((e) => [e._id, e.name]));
  const pickerMonth = month ?? currentMonthIST();
  const today = todayIST();

  const totals = records.reduce(
    (t, r) => ({ net: t.net + (r.calc?.netMinutes ?? 0), p: t.p + (r.calc?.presentDays ?? 0), h: t.h + (r.calc?.hMinutes ?? 0) }),
    { net: 0, p: 0, h: 0 },
  );

  return (
    <div className="animate-rise">
      <PageHeader
        title="Attendance"
        subtitle={month ? `${monthLabel(month)} · ${records.length} records` : `${records.length} open shifts across all months`}
        actions={
          <>
            <MonthPicker month={pickerMonth} basePath="/admin/attendance" params={{ employeeId: sp.employeeId, status }} />
            <AddAttendance employees={employees.filter((e) => e.active)} defaultDate={month && today.startsWith(month) ? today : `${pickerMonth}-01`} disabled={!!lock} />
          </>
        }
      />

      {lock && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          <Lock className="size-4" /> {monthLabel(month!)} payroll is {lock.status === "submitted" ? "waiting for the CEO&apos;s approval" : lock.status}. Records can&apos;t be changed until it is sent back or reopened.
        </div>
      )}

      <Card>
        <form action="/admin/attendance" className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-end">
          {month && <input type="hidden" name="month" value={month} />}
          <label className="sm:w-72">
            <span className={field.label}>Employee</span>
            <select name="employeeId" defaultValue={sp.employeeId ?? ""} className={field.input}>
              <option value="">All employees</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>{e.empCode} · {e.name}</option>
              ))}
            </select>
          </label>
          <label className="sm:w-52">
            <span className={field.label}>Status</span>
            <select name="status" defaultValue={status ?? ""} className={field.input}>
              <option value="">Any status</option>
              {Object.entries(STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-bg">Apply</button>
            {(sp.employeeId || status) && (
              <Link href={`/admin/attendance?month=${pickerMonth}`} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink">Clear</Link>
            )}
          </div>
        </form>

        {records.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No attendance records">Nothing matches this month and filter.</EmptyState>
        ) : (
          <div className={table.wrap}>
            <table className={`${table.table} min-w-[900px]`}>
              <thead>
                <tr>
                  <th className={table.th}>Date</th>
                  <th className={table.th}>Employee</th>
                  <th className={table.th}>In</th>
                  <th className={table.th}>Out</th>
                  <th className={table.thNum}>Paused</th>
                  <th className={table.thNum}>Gross</th>
                  <th className={table.thNum}>Break</th>
                  <th className={table.thNum}>Net</th>
                  <th className={table.thNum}>P</th>
                  <th className={table.thNum}>H</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th} />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const name = names.get(r.employeeId) ?? r.empCode;
                  return (
                    <tr key={r._id} className={table.row}>
                      <td className={table.td}>
                        {dayLabel(r.date)}
                        {r.calc?.isSunday && <span className="ml-1.5"><Badge tone="blue">Sun</Badge></span>}
                      </td>
                      <td className={table.tdStrong}>
                        <Link href={`/admin/employees/${r.employeeId}?month=${r.month}`} className="hover:text-brand">{name}</Link>
                        <span className="font-normal text-ink-faint"> · {r.empCode}</span>
                      </td>
                      <td className={table.td}>{r.inTime}</td>
                      <td className={table.td}>{r.outTime ?? <span className="text-red-600">missing</span>}</td>
                      <td className={table.num}>{r.pausedSeconds ? fmtMinutes(r.pausedSeconds / 60) : "—"}</td>
                      <td className={table.num}>{r.calc ? fmtMinutes(r.calc.grossMinutes) : "—"}</td>
                      <td className={table.num}>{r.calc?.breakMinutes ? `${r.calc.breakMinutes}m` : "—"}</td>
                      <td className={table.num}><b>{r.calc ? fmtMinutes(r.calc.netMinutes) : "—"}</b></td>
                      <td className={table.num}>{r.calc?.presentDays ?? "—"}</td>
                      <td className={table.num}>{r.calc ? fmtMinutes(r.calc.hMinutes) : "—"}</td>
                      <td className={table.td}>
                        {r.status === "open" ? <Badge tone="blue">Open</Badge> : r.status === "completed" ? <Badge tone="green">Present</Badge> : <Badge tone="amber">Short</Badge>}
                      </td>
                      <td className={`${table.td} text-right`}>
                        <EditAttendance
                          disabled={!!lock}
                          rec={{ _id: r._id, employeeId: r.employeeId, name, empCode: r.empCode, date: r.date, inTime: r.inTime, outTime: r.outTime, pausedSeconds: r.pausedSeconds }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2/60 font-semibold">
                  <td className={table.tdStrong} colSpan={7}>Total · {records.length} records</td>
                  <td className={table.num}>{fmtMinutes(totals.net)}</td>
                  <td className={table.num}>{totals.p}</td>
                  <td className={table.num}>{fmtMinutes(totals.h)}</td>
                  <td className={table.td} colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
