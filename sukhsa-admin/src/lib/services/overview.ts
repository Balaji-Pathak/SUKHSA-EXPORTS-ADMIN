import "server-only";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type AttendanceRecord, type Employee } from "@/lib/schema";
import { todayIST } from "@/lib/dates";
import { monthlyPayroll } from "./payroll";

/** Everything the Overview page shows, in one call. */
export async function getOverview(month: string) {
  const db = await getDb();
  const today = todayIST();
  const att = db.collection<AttendanceRecord>(COLLECTIONS.attendance);

  const [empStats, todayRecs, openOld, recent, payroll, latestMonthDoc] = await Promise.all([
    db
      .collection<Employee>(COLLECTIONS.employees)
      .aggregate<{ _id: { category: string; active: boolean }; n: number }>([{ $group: { _id: { category: "$category", active: "$active" }, n: { $sum: 1 } } }])
      .toArray(),
    att.find({ date: today }, { projection: { outTime: 1 } }).toArray(),
    att.countDocuments({ outTime: null, date: { $lt: today } }),
    att.find({ month }, { projection: { source: 0, legacy: 0 } }).sort({ date: -1, updatedAt: -1 }).limit(8).toArray(),
    monthlyPayroll(month),
    att.find({}, { projection: { month: 1 } }).sort({ date: -1 }).limit(1).next(),
  ]);

  const count = (category: string, active: boolean) => empStats.find((s) => s._id.category === category && s._id.active === active)?.n ?? 0;
  const names = new Map(payroll.rows.map((r) => [r.employeeId, r.name]));

  return {
    month,
    today,
    latestMonthWithData: latestMonthDoc?.month ?? null,
    employees: {
      active: count("permanent", true) + count("temporary", true),
      permanent: count("permanent", true),
      temporary: count("temporary", true),
      inactive: count("permanent", false) + count("temporary", false),
    },
    today_: { records: todayRecs.length, stillIn: todayRecs.filter((r) => !r.outTime).length },
    month_: {
      records: payroll.rows.reduce((s, r) => s + r.days, 0),
      employeesWorked: payroll.rows.filter((r) => r.days > 0).length,
      presentDays: payroll.totals.presentDays,
      workingHours: payroll.totals.workingHours,
      payable: payroll.totals.payableAmount,
      status: payroll.run.status,
      statusLabel: payroll.run.statusLabel,
    },
    alerts: {
      openShiftsBeforeToday: openOld,
      shortShiftsThisMonth: await att.countDocuments({ month, status: "short_shift" }),
    },
    topEarners: payroll.rows.filter((r) => r.payableAmount > 0).sort((a, b) => b.payableAmount - a.payableAmount).slice(0, 5),
    recent: recent.map((r) => ({ ...r, name: names.get(r.employeeId) ?? r.empCode })),
  };
}
