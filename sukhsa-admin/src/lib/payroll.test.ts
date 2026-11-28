import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateDay, calculateMonth, dayPayable, isSundayDate, PayrollInputError } from "./payroll";

// 2026-10-05 is a Monday, 2026-10-04 is a Sunday.
const MON = "2026-10-05";
const SUN = "2026-10-04";

test("Sunday detection", () => {
  assert.equal(isSundayDate(SUN), true);
  assert.equal(isSundayDate(MON), false);
});

test("full 8h day: 09:00-17:30 => gross 510, break 30, net 480, 1 Present, 0 OT, 0 H", () => {
  const r = calculateDay({ date: MON, inTime: "09:00", outTime: "17:30" });
  assert.deepEqual(
    [r.grossMinutes, r.breakMinutes, r.netMinutes, r.presentDays, r.overtimeMinutes, r.hMinutes, r.status, r.isOvernight],
    [510, 30, 480, 1, 0, 0, "completed", false],
  );
});

test("minutes beyond 8h are overtime and count as H", () => {
  const r = calculateDay({ date: MON, inTime: "09:00", outTime: "19:00" }); // gross 600, net 570
  assert.equal(r.presentDays, 1);
  assert.equal(r.overtimeMinutes, 90);
  assert.equal(r.hMinutes, 90);
});

test("under 8h: 0 Present, 0 OT, all net minutes are H, short_shift", () => {
  const r = calculateDay({ date: MON, inTime: "09:00", outTime: "16:00" }); // gross 420, net 390
  assert.deepEqual([r.netMinutes, r.presentDays, r.overtimeMinutes, r.hMinutes, r.status], [390, 0, 0, 390, "short_shift"]);
});

test("break only at gross >= 4.5h (boundary)", () => {
  assert.equal(calculateDay({ date: MON, inTime: "09:00", outTime: "13:29" }).breakMinutes, 0); // 269
  assert.equal(calculateDay({ date: MON, inTime: "09:00", outTime: "13:30" }).breakMinutes, 30); // 270
  assert.equal(calculateDay({ date: MON, inTime: "09:00", outTime: "13:00" }).netMinutes, 240);
});

test("one minute under 8h net is not Present", () => {
  const r = calculateDay({ date: MON, inTime: "09:00", outTime: "17:29" }); // gross 509, net 479
  assert.equal(r.presentDays, 0);
  assert.equal(r.hMinutes, 479);
});

test("Sunday: 0 Present, all net minutes are OT and H", () => {
  const r = calculateDay({ date: SUN, inTime: "09:00", outTime: "17:30" });
  assert.deepEqual([r.presentDays, r.overtimeMinutes, r.hMinutes, r.status], [0, 480, 480, "completed"]);
  assert.equal(calculateDay({ date: SUN, inTime: "09:00", outTime: "09:00" }).status, "short_shift");
});

test("paused (Away) time is rounded to the nearest minute and removed before the break rule", () => {
  // 09:00-14:00 = 300 min, paused 40 min -> gross 260 (< 270, no break)
  const r = calculateDay({ date: MON, inTime: "09:00", outTime: "14:00", pausedSeconds: 40 * 60 });
  assert.equal(r.grossMinutes, 260);
  assert.equal(r.breakMinutes, 0);
  assert.equal(calculateDay({ date: MON, inTime: "09:00", outTime: "10:00", pausedSeconds: 90 }).pausedMinutes, 2); // 1.5 -> 2
  assert.equal(calculateDay({ date: MON, inTime: "09:00", outTime: "10:00", pausedSeconds: 89 }).pausedMinutes, 1);
});

test("overnight shift: out before in adds 24 hours", () => {
  const r = calculateDay({ date: MON, inTime: "22:00", outTime: "06:30" }); // 510 span
  assert.deepEqual([r.isOvernight, r.grossMinutes, r.netMinutes, r.presentDays], [true, 510, 480, 1]);
});

test("invalid time is rejected", () => {
  assert.throws(() => calculateDay({ date: MON, inTime: "25:00", outTime: "09:00" }), PayrollInputError);
});

test("month: payable = (Working - Theka) x rate, never below zero; gross and Theka amounts", () => {
  const days = [
    { presentDays: 1 as const, netMinutes: 570, hMinutes: 90, overtimeMinutes: 90 },
    { presentDays: 0 as const, netMinutes: 390, hMinutes: 390, overtimeMinutes: 0 },
  ];
  const m = calculateMonth("2026-10", days, 60, 84.38);
  assert.deepEqual(
    [m.presentDays, m.workingMinutes, m.overtimeMinutes, m.totalHMinutes, m.normalHMinutes, m.netPayableMinutes, m.netPayableHours, m.payableAmount],
    [1, 960, 90, 480, 420, 900, 15, 1265.7],
  );
  assert.equal(m.grossPayable, 1350.08);
  assert.equal(m.thekaDeductionAmount, 84.38);
  assert.equal(calculateMonth("2026-10", days, 10_000, 84.38).payableAmount, 0);
});

test("matches October 2026 master sheet for EMP-001", () => {
  const full = Array.from({ length: 14 }, () => ({ presentDays: 1 as const, netMinutes: 480, hMinutes: 0 }));
  const short = [390, 420, 450, 420, 450, 240].map((n) => ({ presentDays: 0 as const, netMinutes: n, hMinutes: n }));
  const m = calculateMonth("2026-10", [...full, ...short], 60, 84.38);
  assert.equal(m.workingMinutes / 60, 151.5); // Working Hours
  assert.equal(m.presentDays, 14); // Present (P)
  assert.equal(m.normalHMinutes / 60, 38.5); // Normal Hours (H)
  assert.equal(m.payableAmount, 12699.19); // Net Payable
});

test("day preview payable matches old app (8.00h x 84.38 = 675.04; 6.50h = 548.47)", () => {
  assert.equal(dayPayable(480, 84.38), 675.04);
  assert.equal(dayPayable(390, 84.38), 548.47);
});

test("2-decimal hourly rate: 8h x 75.13 = 601.04", () => {
  const m = calculateMonth("2026-10", [{ presentDays: 1, netMinutes: 480, hMinutes: 0 }], 0, 75.13);
  assert.equal(m.payableAmount, 601.04);
});
