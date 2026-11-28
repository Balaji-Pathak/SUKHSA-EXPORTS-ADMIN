import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarCheck, Download, IndianRupee, Clock, Hourglass, Lock, Timer } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { getEmployee, getThekaForEmployee, listDepartments } from "@/lib/services/employees";
import { employeeSheet } from "@/lib/services/employee-sheet";
import { getLock } from "@/lib/services/locks";
import { listAudit } from "@/lib/services/audit";
import { fmtRate, fmtRupees, isValidMonth, monthLabel } from "@/lib/dates";
import { Badge, Card, CardHeader, EmptyState, MonthPicker, StatCard, btn, table } from "@/components/ui/ui";
import { DeleteEmployeeButton, EmployeeDialog, ToggleActiveButton } from "@/components/admin/EmployeeDialog";
import { EditAttendance } from "@/components/admin/AttendanceDialog";
import { ThekaForm } from "@/components/admin/ThekaForm";
import { AuditList } from "@/components/admin/AuditList";

export const metadata: Metadata = { title: "Employee · Sukhsa Exports Admin" };

async function load(id: string) {
  try {
    return await getEmployee(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

const h2 = (n: number | null) => (n === null ? "—" : `${n.toFixed(2)}h`);

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const e = await load(id);
  const sheet = await employeeSheet(id, isValidMonth(sp.month) ? sp.month : undefined);
  const month = sheet.month ?? new Date().toISOString().slice(0, 7);
  const [theka, departments, lock, history, thekaHistory] = await Promise.all([
    getThekaForEmployee(id),
    listDepartments(),
    getLock(month),
    listAudit({ entity: "employee", entityId: id, limit: 20 }),
    listAudit({ entity: "theka", entityId: id, limit: 20 }),
  ]);
  const m = sheet.summary;
  const totalRecords = sheet.months.reduce((s, x) => s + x.entries, 0);
  const changes = [...history, ...thekaHistory].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 20);

  return (
    <div className="animate-rise space-y-6">
      <Link href="/admin/employees" className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-brand">
        <ArrowLeft className="size-4" /> All employees
      </Link>

      <Card className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge tone={e.category === "permanent" ? "green" : "amber"}>{e.category === "permanent" ? "Sukhsa Export Permanent" : "Sukhsa Export Temporary"}</Badge>
              {e.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{e.name}</h1>
            <p className="mt-1 text-ink-soft">
              {e.empCode} · {e.department || "No department"} · Rate <b className="text-ink">₹{fmtRate(e.hourlyRate)}/hr</b> · {e.breakMinutes} min break
            </p>
            <p className="mt-2 text-xs text-ink-faint">
              8h+ Mon–Sat = 1 Present (P) · under 8h, overtime beyond 8h and Sundays = Normal Hours (H) · Net Payable = (Working − Theka) × Rate
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EmployeeDialog departments={departments} employee={{ _id: e._id, empCode: e.empCode, name: e.name, department: e.department, category: e.category, hourlyRate: e.hourlyRate, breakMinutes: e.breakMinutes }} />
            <ToggleActiveButton id={e._id} active={e.active} name={e.name} />
            <DeleteEmployeeButton id={e._id} empCode={e.empCode} name={e.name} records={totalRecords} />
          </div>
        </div>
      </Card>

      {/* Saved monthly summaries */}
      <Card>
        <CardHeader title="Monthly summaries" />
        {sheet.months.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No attendance yet" />
        ) : (
          <div className={table.wrap}>
            <table className={`${table.table} min-w-[820px]`}>
              <thead>
                <tr>
                  <th className={table.th}>Month</th>
                  <th className={table.thNum}>Present (P)</th>
                  <th className={table.thNum}>Working hrs</th>
                  <th className={table.thNum}>Overtime</th>
                  <th className={table.thNum}>Theka</th>
                  <th className={table.thNum}>Net normal (H)</th>
                  <th className={table.thNum}>Net payable</th>
                  <th className={table.th} />
                </tr>
              </thead>
              <tbody>
                {sheet.months.map((s) => (
                  <tr key={s.month} className={`${table.row} ${s.month === month ? "bg-brand-soft/40" : ""}`}>
                    <td className={table.tdStrong}>
                      {s.label}
                      <span className="block text-xs font-normal text-ink-faint">{s.entries} entries{s.openShifts ? ` · ${s.openShifts} open` : ""}</span>
                    </td>
                    <td className={table.num}>{s.presentDays}</td>
                    <td className={table.num}>{h2(s.workingHours)}</td>
                    <td className={table.num}>{h2(s.overtimeHours)}</td>
                    <td className={table.num}>{s.thekaHours ? `−${s.thekaHours.toFixed(2)}h` : "—"}</td>
                    <td className={table.num}>{h2(s.normalHours)}</td>
                    <td className={table.num}><b>{fmtRupees(s.payableAmount)}</b></td>
                    <td className={`${table.td} text-right`}>
                      <Link href={`/admin/employees/${id}?month=${s.month}`} className={btn.ghost}>View days</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Selected month */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          History attendance · {monthLabel(month)} {lock && <Badge><Lock className="size-3" /> Locked</Badge>}
        </h2>
        <div className="flex flex-wrap gap-2">
          <MonthPicker month={month} basePath={`/admin/employees/${id}`} />
          <a href={`/api/v1/employees/${id}/sheet?month=${month}&format=csv`} className={btn.secondary}>
            <Download className="size-4" /> Export CSV
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={CalendarCheck} label="Present (P)" value={m?.presentDays ?? 0} tone="accent" />
        <StatCard icon={Clock} label="Total working" value={`${(m?.workingHours ?? 0).toFixed(2)}h`} tone="ink" />
        <StatCard icon={Timer} label="Theka working" value={m?.thekaHours ? `−${m.thekaHours.toFixed(2)}h` : "0.00h"} tone="red" />
        <StatCard icon={Hourglass} label="Net normal (H)" value={`${(m?.normalHours ?? 0).toFixed(2)}h`} tone="accent" />
        <StatCard icon={IndianRupee} label="Net payable" value={fmtRupees(m?.payableAmount ?? 0)} hint={`${(m?.payableHours ?? 0).toFixed(2)}h × ₹${fmtRate(e.hourlyRate)}`} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Day sheet" action={<Link href={`/admin/attendance?month=${month}&employeeId=${id}`} className="text-xs font-semibold text-brand">Add a missing day</Link>} />
          {sheet.days.length === 0 ? (
            <EmptyState icon={CalendarCheck} title={`No attendance in ${monthLabel(month)}`} />
          ) : (
            <div className={table.wrap}>
              <table className={`${table.table} min-w-[980px]`}>
                <thead>
                  <tr>
                    <th className={table.th}>Date</th>
                    <th className={table.th}>Day</th>
                    <th className={table.th}>In</th>
                    <th className={table.th}>Out</th>
                    <th className={table.thNum}>Away</th>
                    <th className={table.thNum}>Working</th>
                    <th className={table.thNum}>P</th>
                    <th className={table.thNum}>OT</th>
                    <th className={table.thNum}>Normal (H)</th>
                    <th className={table.thNum}>Payable</th>
                    <th className={table.th}>Status</th>
                    <th className={table.th} />
                  </tr>
                </thead>
                <tbody>
                  {sheet.days.map((d) => (
                    <tr key={d._id} className={table.row}>
                      <td className={`${table.td} font-mono text-xs`}>{d.date}</td>
                      <td className={table.td}>{d.isSunday ? <Badge tone="blue">Sun</Badge> : d.day}</td>
                      <td className={table.td}>{d.inTime}</td>
                      <td className={table.td}>{d.outTime ?? <span className="text-red-600">—</span>}{d.isOvernight && <span className="ml-1 text-xs text-accent">+1d</span>}</td>
                      <td className={table.num}>{d.awayMinutes}m</td>
                      <td className={table.num}><b>{h2(d.workingHours)}</b></td>
                      <td className={table.num}>{d.present ?? "—"}</td>
                      <td className={table.num}>{h2(d.overtimeHours)}</td>
                      <td className={`${table.num} ${d.normalHours ? "text-accent" : ""}`}>{h2(d.normalHours)}</td>
                      <td className={table.num}>{d.payable === null ? "—" : fmtRupees(d.payable)}</td>
                      <td className={table.td}>
                        {d.status === "on_duty" || d.status === "open" ? <Badge tone="blue">Inside</Badge> : d.present ? <Badge tone="green">Done</Badge> : <Badge tone="amber">Short</Badge>}
                      </td>
                      <td className={`${table.td} text-right`}>
                        <EditAttendance disabled={!!lock} rec={{ _id: d._id, employeeId: id, name: e.name, empCode: e.empCode, date: d.date, inTime: d.inTime, outTime: d.outTime, pausedSeconds: d.pausedSeconds }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {m && (
                  <tfoot className="text-sm">
                    <tr className="bg-surface-2/60">
                      <td className={table.tdStrong} colSpan={5}>TOTAL (Before Theka)</td>
                      <td className={table.num}><b>{h2(m.workingHours)}</b></td>
                      <td className={table.num}>{m.presentDays}</td>
                      <td className={table.num}>{h2(m.overtimeHours)}</td>
                      <td className={table.num}>{h2(m.grossNormalHours)}</td>
                      <td className={table.num}>{fmtRupees(m.grossPayable)}</td>
                      <td className={table.td} colSpan={2} />
                    </tr>
                    <tr className="bg-surface-2/60 text-red-600">
                      <td className={table.td} colSpan={5}><span className="text-red-600">Less: Theka Work (H)</span></td>
                      <td className={`${table.num} !text-red-600`}>−{m.thekaHours.toFixed(2)}h</td>
                      <td className={table.td} colSpan={2} />
                      <td className={`${table.num} !text-red-600`}>−{m.thekaHours.toFixed(2)}h</td>
                      <td className={`${table.num} !text-red-600`}>−{fmtRupees(m.thekaDeductionAmount)}</td>
                      <td className={table.td} colSpan={2} />
                    </tr>
                    <tr className="bg-brand-soft/60">
                      <td className={table.tdStrong} colSpan={5}>NET PAYABLE (After Theka)</td>
                      <td className={table.num}><b>{h2(m.payableHours)}</b></td>
                      <td className={table.num}><b>{m.presentDays}</b></td>
                      <td className={table.num}>{h2(m.overtimeHours)}</td>
                      <td className={table.num}><b>{h2(m.normalHours)}</b></td>
                      <td className={table.num}><b>{fmtRupees(m.payableAmount)}</b></td>
                      <td className={table.td} colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Month-end Theka" />
            <div className="p-5">
              <ThekaForm employeeId={id} defaultMonth={month} />
              {theka.length > 0 && (
                <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
                  {theka.map((t) => (
                    <li key={t._id} className="flex justify-between px-3 py-2 text-sm">
                      <span className="text-ink-soft">{monthLabel(t.month)}</span>
                      <span className="font-semibold tabular-nums text-ink">{Math.round((t.thekaMinutes / 60) * 100) / 100} h</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Change history" />
            <AuditList entries={changes} />
          </Card>
        </div>
      </div>
    </div>
  );
}
