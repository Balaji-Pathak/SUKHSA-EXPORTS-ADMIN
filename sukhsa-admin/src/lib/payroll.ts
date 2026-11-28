/**
 * Sukhsa Exports payroll rules (Business Logic Specification §1–3). Pure functions, no
 * database access, so the same code runs in API routes, the Gate Desk, scripts and tests.
 *
 * Daily
 *   span    = out - in   (if out < in the shift crossed midnight: out += 24 h)
 *   gross   = span - round(pausedSeconds / 60)
 *   break   = min(breakMinutes, gross) only if gross >= 4.5 h (270 min), else 0
 *   net     = gross - break
 *   Mon–Sat : net >= 8 h -> P = 1, OT = net - 8 h, H = OT,  status "completed"
 *             net <  8 h -> P = 0, OT = 0,          H = net, status "short_shift"
 *   Sunday  : P = 0, OT = net, H = net, status "completed" (or "short_shift" if net = 0)
 *
 * Monthly
 *   Working Hours      = sum of net
 *   Normal Hours (H)   = max(0, sum of H - Theka)
 *   Payable minutes    = max(0, Working - Theka)
 *   Net Payable        = Payable hours x hourly rate
 */

export const BREAK_THRESHOLD_MINUTES = 270; // 4.5 hours
export const DEFAULT_BREAK_MINUTES = 30;
export const FULL_DAY_MINUTES = 480; // 8 hours

export interface DayInput {
  /** "YYYY-MM-DD" (the day the shift started) */
  date: string;
  /** "HH:MM" 24-hour */
  inTime: string;
  /** "HH:MM" 24-hour; earlier than inTime means the shift ended after midnight */
  outTime: string;
  /** Total paused (Away) time in seconds. */
  pausedSeconds?: number;
  /** Break length for this employee. Defaults to 30. */
  breakMinutes?: number;
}

export interface DayResult {
  date: string;
  isSunday: boolean;
  isOvernight: boolean;
  pausedMinutes: number;
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  presentDays: 0 | 1;
  overtimeMinutes: number;
  /** Minutes counted as Normal Hours (H). */
  hMinutes: number;
  status: "completed" | "short_shift";
}

export interface MonthResult {
  month: string;
  days: number;
  presentDays: number;
  /** "Working Hours": all net minutes in the month. */
  workingMinutes: number;
  overtimeMinutes: number;
  totalHMinutes: number;
  thekaMinutes: number;
  /** "Normal Hours (H)": H minutes left after Theka. */
  normalHMinutes: number;
  netPayableMinutes: number;
  netPayableHours: number;
  hourlyRate: number;
  grossPayable: number;
  thekaDeductionAmount: number;
  payableAmount: number;
}

export class PayrollInputError extends Error {}

/** "HH:MM" -> minutes since midnight. */
export function parseTime(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) throw new PayrollInputError(`Invalid time "${t}", expected HH:MM`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new PayrollInputError(`Invalid time "${t}"`);
  return h * 60 + min;
}

/** Sunday check from the calendar date itself, independent of server timezone. */
export function isSundayDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new PayrollInputError(`Invalid date "${date}", expected YYYY-MM-DD`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay() === 0;
}

export function calculateDay(input: DayInput): DayResult {
  const inMin = parseTime(input.inTime);
  let outMin = parseTime(input.outTime);
  const isOvernight = outMin < inMin;
  if (isOvernight) outMin += 1440;

  const spanMinutes = Math.max(0, outMin - inMin);
  const pausedMinutes = Math.round((input.pausedSeconds ?? 0) / 60);
  const grossMinutes = Math.max(0, spanMinutes - pausedMinutes);
  const breakMinutes = grossMinutes >= BREAK_THRESHOLD_MINUTES ? Math.min(input.breakMinutes ?? DEFAULT_BREAK_MINUTES, grossMinutes) : 0;
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  const isSunday = isSundayDate(input.date);

  let presentDays: 0 | 1 = 0;
  let overtimeMinutes = 0;
  let hMinutes = netMinutes;
  let status: DayResult["status"];
  if (isSunday) {
    overtimeMinutes = netMinutes;
    status = netMinutes > 0 ? "completed" : "short_shift";
  } else if (netMinutes >= FULL_DAY_MINUTES) {
    presentDays = 1;
    overtimeMinutes = netMinutes - FULL_DAY_MINUTES;
    hMinutes = overtimeMinutes;
    status = "completed";
  } else {
    status = "short_shift";
  }
  return { date: input.date, isSunday, isOvernight, pausedMinutes, grossMinutes, breakMinutes, netMinutes, presentDays, overtimeMinutes, hMinutes, status };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateMonth(
  month: string,
  days: (Pick<DayResult, "presentDays" | "hMinutes" | "netMinutes"> & { overtimeMinutes?: number })[],
  thekaMinutes: number,
  hourlyRate: number,
): MonthResult {
  const workingMinutes = days.reduce((s, d) => s + d.netMinutes, 0);
  const totalHMinutes = days.reduce((s, d) => s + d.hMinutes, 0);
  const overtimeMinutes = days.reduce((s, d) => s + (d.overtimeMinutes ?? 0), 0);
  const presentDays = days.reduce((s, d) => s + d.presentDays, 0);
  const normalHMinutes = Math.max(0, totalHMinutes - thekaMinutes);
  const netPayableMinutes = Math.max(0, workingMinutes - thekaMinutes);
  return {
    month,
    days: days.length,
    presentDays,
    workingMinutes,
    overtimeMinutes,
    totalHMinutes,
    thekaMinutes,
    normalHMinutes,
    netPayableMinutes,
    netPayableHours: round2(netPayableMinutes / 60),
    hourlyRate,
    grossPayable: round2((workingMinutes / 60) * hourlyRate),
    thekaDeductionAmount: round2((Math.min(workingMinutes, thekaMinutes) / 60) * hourlyRate),
    // From exact minutes, so rounding the hours never shifts the rupee value.
    payableAmount: round2((netPayableMinutes / 60) * hourlyRate),
  };
}

/** Single-day preview amount (no Theka): working hours x rate. */
export const dayPayable = (netMinutes: number, hourlyRate: number) => round2(round2(netMinutes / 60) * hourlyRate);

export const minutesToHours = (m: number) => round2(m / 60);
