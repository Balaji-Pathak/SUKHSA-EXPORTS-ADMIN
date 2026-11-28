import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { auth } from "@/auth";
import { teamEmployeeIds } from "@/lib/services/teams";
import { listAttendance } from "@/lib/services/attendance";
import { listEmployees } from "@/lib/services/employees";
import { currentMonthIST, dayLabel, fmtMinutes, isValidMonth, monthLabel } from "@/lib/dates";
import { Badge, Card, EmptyState, MonthPicker, PageHeader, table } from "@/components/ui/ui";

export const metadata: Metadata = { title: "Team attendance · Sukhsa Exports" };

/** Read-only attendance for the supervisor's own team (no pay information). */
export default async function TeamAttendance({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonthIST();
  const session = await auth();
  const team = await teamEmployeeIds(session!.user.id);
  const [records, employees] = await Promise.all([
    team.length ? listAttendance({ month }, team) : Promise.resolve([]),
    listEmployees({ supervisorId: session!.user.id }),
  ]);
  const names = new Map(employees.map((e) => [e._id, e.name]));

  return (
    <div className="animate-rise">
      <PageHeader title="Team attendance" subtitle={`${monthLabel(month)} · ${records.length} records`} actions={<MonthPicker month={month} basePath="/supervisor/attendance" />} />
      <Card>
        {records.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No attendance for your team this month" />
        ) : (
          <div className={table.wrap}>
            <table className={`${table.table} min-w-[760px]`}>
              <thead>
                <tr>
                  <th className={table.th}>Date</th>
                  <th className={table.th}>Worker</th>
                  <th className={table.th}>In</th>
                  <th className={table.th}>Out</th>
                  <th className={table.thNum}>Away</th>
                  <th className={table.thNum}>Worked</th>
                  <th className={table.thNum}>P</th>
                  <th className={table.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id} className={table.row}>
                    <td className={table.td}>{dayLabel(r.date)}</td>
                    <td className={table.tdStrong}>{names.get(r.employeeId) ?? r.empCode} <span className="font-normal text-ink-faint">· {r.empCode}</span></td>
                    <td className={table.td}>{r.inTime}</td>
                    <td className={table.td}>{r.outTime ?? "—"}</td>
                    <td className={table.num}>{r.pausedSeconds ? fmtMinutes(Math.round(r.pausedSeconds / 60)) : "—"}</td>
                    <td className={table.num}>{r.calc ? fmtMinutes(r.calc.netMinutes) : "—"}</td>
                    <td className={table.num}>{r.calc?.presentDays ?? "—"}</td>
                    <td className={table.td}>
                      {!r.outTime ? <Badge tone="blue">Inside</Badge> : r.calc?.presentDays ? <Badge tone="green">Present</Badge> : <Badge tone="amber">Short</Badge>}
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
