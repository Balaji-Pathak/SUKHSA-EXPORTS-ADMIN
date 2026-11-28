import "server-only";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type AttendanceRecord, type Employee, type MonthlyTheka } from "@/lib/schema";
import { calculateMonth, minutesToHours } from "@/lib/payroll";
import { monthLabel } from "@/lib/dates";
import { getRun, STATUS_LABEL } from "./locks";

export interface PayrollRow {
  employeeId: string;
  empCode: string;
  name: string;
  department: string;
  category: "permanent" | "temporary";
  hourlyRate: number;
  days: number;
  workingHours: number;
  presentDays: number;
  thekaHours: number;
  normalHours: number;
  netPayableHours: number;
  payableAmount: number;
  openShifts: number;
}

/**
 * Monthly payroll, same columns as the master Google Sheet.
 * Lists every active employee (zeros if no attendance) plus inactive ones who worked that month.
 */
export async function monthlyPayroll(month: string, category?: "permanent" | "temporary") {
  const db = await getDb();
  const [records, theka, run] = await Promise.all([
    db.collection<AttendanceRecord>(COLLECTIONS.attendance).find({ month }, { projection: { employeeId: 1, calc: 1 } }).toArray(),
    db.collection<MonthlyTheka>(COLLECTIONS.monthlyTheka).find({ month }).toArray(),
    getRun(month),
  ]);

  const byEmp = new Map<string, AttendanceRecord[]>();
  for (const r of records) byEmp.set(r.employeeId, [...(byEmp.get(r.employeeId) ?? []), r]);
  const thekaBy = new Map(theka.map((t) => [t.employeeId, t.thekaMinutes]));

  const empFilter: Record<string, unknown> = { $or: [{ active: true }, { _id: { $in: [...byEmp.keys()] } }] };
  if (category) empFilter.category = category;
  const employees = await db.collection<Employee>(COLLECTIONS.employees).find(empFilter).sort({ empCode: 1 }).toArray();

  const rows: PayrollRow[] = employees.map((e) => {
    const recs = byEmp.get(e._id) ?? [];
    const done = recs.filter((r) => r.calc).map((r) => r.calc!);
    const m = calculateMonth(month, done, thekaBy.get(e._id) ?? 0, e.hourlyRate);
    return {
      employeeId: e._id,
      empCode: e.empCode,
      name: e.name,
      department: e.department,
      category: e.category,
      hourlyRate: e.hourlyRate,
      days: m.days,
      workingHours: minutesToHours(m.workingMinutes),
      presentDays: m.presentDays,
      thekaHours: minutesToHours(m.thekaMinutes),
      normalHours: minutesToHours(m.normalHMinutes),
      netPayableHours: m.netPayableHours,
      payableAmount: m.payableAmount,
      openShifts: recs.length - done.length,
    };
  });

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totals = rows.reduce(
    (t, r) => ({
      employees: t.employees + 1,
      workingHours: round2(t.workingHours + r.workingHours),
      presentDays: t.presentDays + r.presentDays,
      thekaHours: round2(t.thekaHours + r.thekaHours),
      normalHours: round2(t.normalHours + r.normalHours),
      payableAmount: round2(t.payableAmount + r.payableAmount),
      openShifts: t.openShifts + r.openShifts,
    }),
    { employees: 0, workingHours: 0, presentDays: 0, thekaHours: 0, normalHours: 0, payableAmount: 0, openShifts: 0 },
  );

  const status = run?.status ?? "draft";
  return {
    month,
    label: monthLabel(month),
    category: category ?? "all",
    run: { status, statusLabel: STATUS_LABEL[status], frozen: status === "submitted" || status === "approved" || status === "paid", submitted: run?.submitted ?? null, approved: run?.approved ?? null, paid: run?.paid ?? null, note: run?.note ?? null, events: run?.events ?? [] },
    rows,
    totals,
  };
}

/** CSV that opens directly in Excel (UTF-8 BOM so ₹ and Hindi names show correctly). */
export function payrollCsv(p: Awaited<ReturnType<typeof monthlyPayroll>>): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Employee ID", "Employee Name", "Department", "Category", "Hourly Rate", "Working Hours", "Present (P)", "Theka Work (H)", "Normal Hours (H)", "Net Payable Hours", "Net Payable"];
  const lines = p.rows.map((r) =>
    [r.empCode, r.name, r.department, r.category, r.hourlyRate, r.workingHours, r.presentDays, r.thekaHours, r.normalHours, r.netPayableHours, r.payableAmount].map(esc).join(","),
  );
  const t = p.totals;
  lines.push(["TOTAL", `${t.employees} Staff`, "", "", "", t.workingHours, t.presentDays, t.thekaHours, t.normalHours, "", t.payableAmount].map(esc).join(","));
  return "﻿" + [`Sukhsa Exports payroll,${esc(p.label)},${esc(p.run.statusLabel)}`, "", head.join(","), ...lines].join("\r\n");
}
