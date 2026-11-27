/**
 * Monthly payroll summary from the central database, using src/lib/payroll.ts.
 *
 *   npm run payroll:month -- 2026-10
 *
 * Read-only. Compare these numbers with the Google Sheet for the same month.
 */
import { openMirror, requireEnv } from "./lib/common";
import { calculateMonth, minutesToHours } from "../src/lib/payroll";
import { COLLECTIONS, type AttendanceRecord, type Employee, type MonthlyTheka } from "../src/lib/schema";

async function main() {
  const month = process.argv[2];
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    console.error("Usage: npm run payroll:month -- YYYY-MM");
    process.exit(1);
  }
  const { client } = await openMirror();
  const db = client.db(requireEnv("MONGODB_DB"));

  const att = await db.collection<AttendanceRecord>(COLLECTIONS.attendance).find({ month, calc: { $ne: null } }).toArray();
  const byEmp = new Map<string, AttendanceRecord[]>();
  for (const a of att) byEmp.set(a.employeeId, [...(byEmp.get(a.employeeId) ?? []), a]);

  const employees = await db.collection<Employee>(COLLECTIONS.employees).find({ _id: { $in: [...byEmp.keys()] } }).toArray();
  const theka = await db.collection<MonthlyTheka>(COLLECTIONS.monthlyTheka).find({ month }).toArray();
  const thekaBy = new Map(theka.map((t) => [t.employeeId, t.thekaMinutes]));

  const rows: Record<string, unknown>[] = [];
  for (const e of employees.sort((a, b) => a.empCode.localeCompare(b.empCode))) {
    const m = calculateMonth(month, byEmp.get(e._id)!.map((a) => a.calc!), thekaBy.get(e._id) ?? 0, e.hourlyRate);
    rows.push({
      empCode: e.empCode,
      category: e.category,
      rate: m.hourlyRate,
      "working hrs": minutesToHours(m.workingMinutes),
      "present (P)": m.presentDays,
      "theka (H)": minutesToHours(m.thekaMinutes),
      "normal hrs (H)": minutesToHours(m.normalHMinutes),
      "net payable ₹": m.payableAmount,
    });
  }
  console.log(`Payroll for ${month}: ${rows.length} employee(s) with attendance\n`);
  console.table(rows);
  await client.close();
}

main().catch((err) => {
  console.error("Payroll summary failed:", err);
  process.exit(1);
});
