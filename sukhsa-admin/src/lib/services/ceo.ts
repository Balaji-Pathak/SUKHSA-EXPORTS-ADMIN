import "server-only";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type AttendanceRecord, type Employee } from "@/lib/schema";
import { currentMonthIST, monthLabel, shiftMonth, todayIST } from "@/lib/dates";
import { monthlyPayroll } from "./payroll";
import { gateBoard } from "./gate";
import { listRuns } from "./payroll-runs";

/** Everything on the CEO dashboard: approvals waiting, payroll trend, headcount, today at the gate. */
export async function ceoOverview() {
  const db = await getDb();
  const current = currentMonthIST();
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(current, i - 5));
  const today = todayIST();

  const [trend, pending, recentRuns, board, empStats, openShifts] = await Promise.all([
    Promise.all(months.map((m) => monthlyPayroll(m))),
    listRuns({ status: ["submitted"] }),
    listRuns({ limit: 6 }),
    gateBoard(),
    db
      .collection<Employee>(COLLECTIONS.employees)
      .aggregate<{ _id: { category: string; active: boolean }; n: number }>([{ $group: { _id: { category: "$category", active: "$active" }, n: { $sum: 1 } } }])
      .toArray(),
    db.collection<AttendanceRecord>(COLLECTIONS.attendance).countDocuments({ outTime: null, date: { $lt: today } }),
  ]);
  const count = (c: string) => empStats.find((s) => s._id.category === c && s._id.active)?.n ?? 0;
  const thisMonth = trend[trend.length - 1];
  const lastWithPay = [...trend].reverse().find((p) => p.totals.payableAmount > 0) ?? null;

  return {
    today,
    currentMonth: current,
    pending: pending.map((r) => ({
      month: r._id,
      label: monthLabel(r._id),
      total: r.submitted?.total ?? 0,
      employees: r.submitted?.employees ?? 0,
      by: r.submitted?.by ?? "",
      at: r.submitted?.at ?? r.updatedAt,
    })),
    trend: trend.map((p) => ({ month: p.month, label: monthLabel(p.month), total: p.totals.payableAmount, status: p.run.status, staff: p.rows.filter((r) => r.days > 0).length })),
    thisMonth: { label: thisMonth.label, total: thisMonth.totals.payableAmount, hours: thisMonth.totals.workingHours, present: thisMonth.totals.presentDays, status: thisMonth.run.status },
    lastWithPay: lastWithPay ? { month: lastWithPay.month, label: lastWithPay.label, total: lastWithPay.totals.payableAmount, status: lastWithPay.run.status } : null,
    headcount: { total: count("permanent") + count("temporary"), permanent: count("permanent"), temporary: count("temporary") },
    gate: board.counts,
    openShifts,
    recentRuns: recentRuns.map((r) => ({ month: r._id, label: monthLabel(r._id), status: r.status, total: r.approved?.total ?? r.submitted?.total ?? 0, updatedAt: r.updatedAt })),
  };
}
