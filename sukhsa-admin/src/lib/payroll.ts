/**
 * Sukhsa Export payroll rules. Pure functions, no database access, so the same code
 * runs in API routes, scripts and tests.
 *
 * Daily rules
 *   gross   = (outTime - inTime) - paused time
 *   break   = 30 min, deducted only if gross >= 4.5 h (270 min)
 *   net     = gross - break
 *   Mon–Sat : net >= 8 h  -> 1 Present, H = net - 8 h
 *             net <  8 h  -> 0 Present, H = net
 *   Sunday  : 0 Present, H = net
 *
 * Monthly rules (match the "October 2026" master sheet columns)
 *   Working Hours       = sum of daily NET hours (Present days included)
 *   Normal Hours (H)    = max(0, sum of daily H - Theka Hours)
 *   Net Payable Hours   = max(0, Working Hours - Theka Hours)
 *   Payable Amount      = Net Payable Hours x hourly rate
 */

export const BREAK_THRESHOLD_MINUTES = 270; // 4.5 hours
export const DEFAULT_BREAK_MINUTES = 30;
export const FULL_DAY_MINUTES = 480; // 8 hours

export interface DayInput {
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" 24-hour */
  inTime: string;
  /** "HH:MM" 24-hour */
  outTime: string;
  /** Total paused time in seconds (Pause / Resume at the Gate Desk). */
  pausedSeconds?: number;
  /** Break length for this employee. Defaults to 30. */
  breakMinutes?: number;
}

export interface DayResult {
  date: string;
  isSunday: boolean;
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  presentDays: 0 | 1;
  /** Minutes counted as H (overtime / normal hours). */
  hMinutes: number;
}

export interface MonthResult {
  month: string;
  days: number;
  presentDays: number;
  /** Sheet "Working Hours": all net minutes in the month. */
  workingMinutes: number;
  totalHMinutes: number;
  thekaMinutes: number;
  /** Sheet "Normal Hours (H)": H minutes left after Theka. */
  normalHMinutes: number;
  netPayableMinutes: number;
  netPayableHours: number;
  hourlyRate: number;
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
  const outMin = parseTime(input.outTime);
  if (outMin < inMin) {
    throw new PayrollInputError(`Out time ${input.outTime} is before in time ${input.inTime} on ${input.date}`);
  }
  const pausedMinutes = Math.floor((input.pausedSeconds ?? 0) / 60);
  const grossMinutes = Math.max(0, outMin - inMin - pausedMinutes);
  const breakMinutes = grossMinutes >= BREAK_THRESHOLD_MINUTES ? (input.breakMinutes ?? DEFAULT_BREAK_MINUTES) : 0;
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  const isSunday = isSundayDate(input.date);

  let presentDays: 0 | 1 = 0;
  let hMinutes = netMinutes;
  if (!isSunday && netMinutes >= FULL_DAY_MINUTES) {
    presentDays = 1;
    hMinutes = netMinutes - FULL_DAY_MINUTES;
  }
  return { date: input.date, isSunday, grossMinutes, breakMinutes, netMinutes, presentDays, hMinutes };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateMonth(
  month: string,
  days: Pick<DayResult, "presentDays" | "hMinutes" | "netMinutes">[],
  thekaMinutes: number,
  hourlyRate: number,
): MonthResult {
  const workingMinutes = days.reduce((s, d) => s + d.netMinutes, 0);
  const totalHMinutes = days.reduce((s, d) => s + d.hMinutes, 0);
  const presentDays = days.reduce((s, d) => s + d.presentDays, 0);
  const normalHMinutes = Math.max(0, totalHMinutes - thekaMinutes);
  const netPayableMinutes = Math.max(0, workingMinutes - thekaMinutes);
  const netPayableHours = round2(netPayableMinutes / 60);
  return {
    month,
    days: days.length,
    presentDays,
    workingMinutes,
    totalHMinutes,
    thekaMinutes,
    normalHMinutes,
    netPayableMinutes,
    netPayableHours,
    hourlyRate,
    // Amount from exact minutes, so rounding the hours never shifts the rupee value.
    payableAmount: round2((netPayableMinutes / 60) * hourlyRate),
  };
}

export const minutesToHours = (m: number) => round2(m / 60);
