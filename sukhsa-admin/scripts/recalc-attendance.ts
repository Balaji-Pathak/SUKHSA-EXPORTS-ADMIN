/**
 * Recalculate payroll fields on every closed attendance record with the current rules
 * (src/lib/payroll.ts). Skips months locked for payroll.  npm run central:recalc
 */
import { openMirror, requireEnv } from "./lib/common";
import { calculateDay } from "../src/lib/payroll";

async function main() {
  const { client } = await openMirror();
  const db = client.db(requireEnv("MONGODB_DB"));
  const locked = new Set((await db.collection("payroll_runs").find({ status: { $in: ["submitted", "approved", "paid"] } }).toArray()).map((l) => String(l._id)));
  const breaks = new Map((await db.collection("employees").find({}, { projection: { breakMinutes: 1 } }).toArray()).map((e) => [String(e._id), Number(e.breakMinutes ?? 30)]));
  let updated = 0, skipped = 0, changedStatus = 0;
  for (const r of await db.collection("attendance").find({ outTime: { $ne: null } }).toArray()) {
    if (locked.has(r.month)) { skipped++; continue; }
    const { date: _d, ...calc } = calculateDay({ date: r.date, inTime: r.inTime, outTime: r.outTime, pausedSeconds: r.pausedSeconds ?? 0, breakMinutes: breaks.get(r.employeeId) ?? 30 });
    void _d;
    if (calc.status !== r.status) changedStatus++;
    await db.collection("attendance").updateOne({ _id: r._id }, { $set: { calc, status: calc.status } });
    updated++;
  }
  console.log(`Recalculated ${updated} records (${changedStatus} status changes), skipped ${skipped} in locked months.`);
  await client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
