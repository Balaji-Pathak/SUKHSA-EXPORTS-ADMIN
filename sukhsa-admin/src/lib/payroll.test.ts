import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateDay, calculateMonth, isSundayDate, PayrollInputError } from "./payroll";

// 2026-10-05 is a Monday, 2026-10-04 is a Sunday.
const MON = "2026-10-05";
const SUN = "2026-10-04";

test("Sunday detection", () => {
  assert.equal(isSundayDate(SUN), true);
  assert.equal(isSundayDate(MON), false);
});

test("full 8h day: 09:00-17:30 => gross 510, break 30, net 480, 1 Present, 0 H", () => {
  assert.deepEqual(calculateDay({ date: MON, inTime: "09:00", outTime: "17:30" }), {
    date: MON, isSunday: false, grossMinutes: 510, breakMinutes: 30, netMinutes: 480, presentDays: 1, hMinutes: 0,
  });
});

test("minutes beyond 8h count as H", () => {
  const r = calculateDay({ date: MON, inTime: "09:00", outTime: "19:00" }); // gross 600, net 570
  assert.equal(r.presentDays, 1);
  assert.equal(r.hMinutes, 90);
});

test("under 8h: 0 Present and all net minutes are H", () => {
  const r = calculateDay({ date: MON, inTime: "09:00", outTime: "16:00" }); // gross 420, net 390
  assert.equal(r.netMinutes, 390);
  assert.equal(r.presentDays, 0);
  assert.equal(r.hMinutes, 390);
});

test("break only at gross >= 4.5h (boundary)", () => {
  assert.equal(calculateDay({ date: MON, inTime: "09:00", outTime: "13:29" }).breakMinutes, 0); // 269
  assert.equal(calculateDay({ date: MON, inTime: "09:00", outTime: "13:30" }).breakMinutes, 30); // 270
  assert.equal(calculateDay({ date: MON, inTime: "09:00", outTime: "13:00" }).netMinutes, 240); // stored short_shift case
});

test("one minute under 8h net is not Present", () => {
  const r = calculateDay({ date: MON, inTime: "09:00", outTime: "17:29" }); // gross 509, net 479
  assert.equal(r.presentDays, 0);
  assert.equal(r.hMinutes, 479);
});

test("Sunday: 0 Present, all net minutes are H", () => {
  const r = calculateDay({ date: SUN, inTime: "09:00", outTime: "17:30" });
  assert.equal(r.presentDays, 0);
  assert.equal(r.hMinutes, 480);
});

test("paused time is removed before break rule", () => {
  // 09:00-14:00 = 300 min, paused 40 min -> gross 260 (< 270, no break)
  const r = calculateDay({ date: MON, inTime: "09:00", outTime: "14:00", pausedSeconds: 40 * 60 });
  assert.equal(r.grossMinutes, 260);
  assert.equal(r.breakMinutes, 0);
});

test("out before in is rejected", () => {
  assert.throws(() => calculateDay({ date: MON, inTime: "17:00", outTime: "09:00" }), PayrollInputError);
});

test("month: payable = (Working - Theka) x rate, never below zero", () => {
  const days = [
    { presentDays: 1 as const, netMinutes: 570, hMinutes: 90 },
    { presentDays: 0 as const, netMinutes: 390, hMinutes: 390 },
  ];
  const m = calculateMonth("2026-10", days, 60, 84.38);
  assert.equal(m.presentDays, 1);
  assert.equal(m.workingMinutes, 960);
  assert.equal(m.totalHMinutes, 480);
  assert.equal(m.normalHMinutes, 420);
  assert.equal(m.netPayableMinutes, 900);
  assert.equal(m.netPayableHours, 15);
  assert.equal(m.payableAmount, 1265.7);

  assert.equal(calculateMonth("2026-10", days, 10_000, 84.38).payableAmount, 0);
});

test("matches October 2026 master sheet for EMP-001", () => {
  // 14 full days (480 net) + short days 390, 420, 450, 420, 450, 240; Theka 60 min; rate 84.38
  const full = Array.from({ length: 14 }, () => ({ presentDays: 1 as const, netMinutes: 480, hMinutes: 0 }));
  const short = [390, 420, 450, 420, 450, 240].map((n) => ({ presentDays: 0 as const, netMinutes: n, hMinutes: n }));
  const m = calculateMonth("2026-10", [...full, ...short], 60, 84.38);
  assert.equal(m.workingMinutes / 60, 151.5); // Working Hours
  assert.equal(m.presentDays, 14); // Present (P)
  assert.equal(m.normalHMinutes / 60, 38.5); // Normal Hours (H)
  assert.equal(m.payableAmount, 12699.19); // Net Payable
});
