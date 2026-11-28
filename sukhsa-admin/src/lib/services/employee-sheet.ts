import "server-only";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type AttendanceRecord, type Employee, type MonthlyTheka } from "@/lib/schema";
import { calculateMonth, dayPayable, minutesToHours } from "@/lib/payroll";
import { dayLabel, monthLabel } from "@/lib/dates";
import { notFound } from "@/lib/api/errors";

/**
 * One employee's "Individual Sheet" (spec §5): a summary row for every month they worked,
 * and a day-by-day sheet for one month with TOTAL (Before Theka) -> Less Theka -> NET PAYABLE.
 */
export async function employeeSheet(employeeId: string, month?: string) {
  const db = await getDb();
  const emp = await db.collection<Employee>(COLLECTIONS.employees).findOne({ _id: employeeId });
  if (!emp) throw notFound("Employee");
  const [records, theka] = await Promise.all([
    db.collection<AttendanceRecord>(COLLECTIONS.attendance).find({ employeeId }, { projection: { source: 0, legacy: 0 } }).sort({ date: 1 }).toArray(),
    db.collection<MonthlyTheka>(COLLECTIONS.monthlyTheka).find({ employeeId }).toArray(),
  ]);
  const thekaBy = new Map(theka.map((t) => [t.month, t.thekaMinutes]));

  const byMonth = new Map<string, AttendanceRecord[]>();
  for (const r of records) byMonth.set(r.month, [...(byMonth.get(r.month) ?? []), r]);
  for (const m of thekaBy.keys()) if (!byMonth.has(m)) byMonth.set(m, []);

  const summarize = (m: string) => {
    const recs = byMonth.get(m) ?? [];
    const done = recs.filter((r) => r.calc).map((r) => r.calc!);
    const s = calculateMonth(m, done, thekaBy.get(m) ?? 0, emp.hourlyRate);
    return {
      month: m,
      label: monthLabel(m),
      entries: recs.length,
      openShifts: recs.length - done.length,
      presentDays: s.presentDays,
      workingHours: minutesToHours(s.workingMinutes),
      overtimeHours: minutesToHours(s.overtimeMinutes),
      grossNormalHours: minutesToHours(s.totalHMinutes),
      thekaHours: minutesToHours(s.thekaMinutes),
      normalHours: minutesToHours(s.normalHMinutes),
      payableHours: s.netPayableHours,
      grossPayable: s.grossPayable,
      thekaDeductionAmount: s.thekaDeductionAmount,
      payableAmount: s.payableAmount,
    };
  };

  const months = [...byMonth.keys()].sort().reverse().map(summarize);
  const selected = month ?? months[0]?.month ?? null;
  const days = selected
    ? (byMonth.get(selected) ?? []).map((r) => ({
        _id: r._id,
        date: r.date,
        day: dayLabel(r.date).split(",")[0],
        inTime: r.inTime,
        outTime: r.outTime,
        pausedSeconds: r.pausedSeconds ?? 0,
        awayMinutes: Math.round((r.pausedSeconds ?? 0) / 60),
        workingHours: r.calc ? minutesToHours(r.calc.netMinutes) : null,
        present: r.calc?.presentDays ?? null,
        overtimeHours: r.calc ? minutesToHours(r.calc.overtimeMinutes ?? 0) : null,
        normalHours: r.calc ? minutesToHours(r.calc.hMinutes) : null,
        payable: r.calc ? dayPayable(r.calc.netMinutes, emp.hourlyRate) : null,
        status: r.status,
        isSunday: r.calc?.isSunday ?? false,
        isOvernight: r.calc?.isOvernight ?? false,
      }))
    : [];

  return {
    employee: { id: emp._id, empCode: emp.empCode, name: emp.name, department: emp.department, category: emp.category, hourlyRate: emp.hourlyRate },
    months,
    month: selected,
    summary: selected ? (months.find((m) => m.month === selected) ?? summarize(selected)) : null,
    days,
  };
}

/** The individual monthly tab as CSV, same layout as the old Google Sheet. */
export function employeeSheetCsv(s: Awaited<ReturnType<typeof employeeSheet>>): string {
  const esc = (v: unknown) => {
    const t = String(v ?? "");
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const e = s.employee;
  const lines = [
    [`${e.empCode} - ${e.name}`, e.category === "permanent" ? "Sukhsa Export Permanent" : "Sukhsa Export Temporary", s.summary?.label ?? "", `Rate ₹${e.hourlyRate}/hr`].map(esc).join(","),
    "",
    ["Date", "Day", "In Time", "Out Time", "Away (mins)", "Working Hours", "Present (P)", "Overtime (hrs)", "Normal Hours (H)", "Payable Amount"].join(","),
    ...s.days.map((d) => [d.date, d.day, d.inTime, d.outTime ?? "", d.awayMinutes, d.workingHours ?? "", d.present ?? "", d.overtimeHours ?? "", d.normalHours ?? "", d.payable ?? ""].map(esc).join(",")),
  ];
  if (s.summary) {
    const m = s.summary;
    lines.push("");
    lines.push(["TOTAL (Before Theka)", "", "", "", "", m.workingHours, m.presentDays, m.overtimeHours, m.grossNormalHours, m.grossPayable].map(esc).join(","));
    lines.push(["Less: Theka Work (H)", "", "", "", "", -m.thekaHours, "", "", -m.thekaHours, -m.thekaDeductionAmount].map(esc).join(","));
    lines.push(["NET PAYABLE (After Theka)", "", "", "", "", m.payableHours, m.presentDays, m.overtimeHours, m.normalHours, m.payableAmount].map(esc).join(","));
  }
  return "﻿" + lines.join("\r\n");
}
