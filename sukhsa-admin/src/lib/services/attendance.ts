import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type AttendanceRecord, type Employee } from "@/lib/schema";
import { calculateDay, PayrollInputError } from "@/lib/payroll";
import { ApiError, notFound, type Actor } from "@/lib/api/errors";
import { DATE_RE, MONTH_RE, TIME_RE } from "@/lib/dates";
import { diff, logChange } from "./audit";
import { assertMonthOpen } from "./locks";

// ---------- validation ----------

export const attendanceQuery = z.object({
  month: z.string().regex(MONTH_RE, "use YYYY-MM").optional(),
  date: z.string().regex(DATE_RE, "use YYYY-MM-DD").optional(),
  employeeId: z.string().optional(),
  status: z.enum(["open", "on_duty", "completed", "short_shift"]).optional(),
});

const timeOrNull = z.union([z.string().regex(TIME_RE, "use HH:MM"), z.literal(""), z.null()]).transform((v) => v || null);

export const attendanceInput = z.object({
  employeeId: z.string().min(1, "required"),
  date: z.string().regex(DATE_RE, "use YYYY-MM-DD"),
  inTime: z.string().regex(TIME_RE, "use HH:MM"),
  outTime: timeOrNull.default(null),
  pausedMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  reason: z.string().trim().max(300).optional(),
});

export const attendancePatch = z.object({
  inTime: z.string().regex(TIME_RE, "use HH:MM").optional(),
  outTime: timeOrNull.optional(),
  pausedMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  reason: z.string({ error: "please give a reason for the correction" }).trim().min(3, "please give a reason for the correction").max(300),
});

export const deleteInput = z.object({ reason: z.string({ error: "please give a reason" }).trim().min(3, "please give a reason").max(300) });

// ---------- helpers ----------

/** Payroll fields for a record (spec §1–2). No Out time yet -> still open, nothing calculated. */
export function compute(e: Pick<Employee, "breakMinutes">, date: string, inTime: string, outTime: string | null, pausedSeconds: number) {
  if (!outTime) return { calc: null, status: "open" };
  try {
    const { date: _d, ...calc } = calculateDay({ date, inTime, outTime, pausedSeconds, breakMinutes: e.breakMinutes });
    void _d;
    return { calc, status: calc.status as string };
  } catch (err) {
    if (err instanceof PayrollInputError) throw new ApiError(400, err.message);
    throw err;
  }
}

// ---------- reads ----------

/** `onlyEmployeeIds` limits results to a team (used for supervisors). */
export async function listAttendance(q: z.infer<typeof attendanceQuery>, onlyEmployeeIds?: string[]) {
  const db = await getDb();
  const filter: Record<string, unknown> = {};
  if (q.month) filter.month = q.month;
  if (q.date) filter.date = q.date;
  if (q.employeeId) filter.employeeId = q.employeeId;
  if (onlyEmployeeIds) filter.employeeId = q.employeeId ? (onlyEmployeeIds.includes(q.employeeId) ? q.employeeId : "__none__") : { $in: onlyEmployeeIds };
  // "open" = any shift without an Out time (Gate Desk "on_duty" or a manual entry).
  if (q.status === "open") filter.outTime = null;
  else if (q.status) filter.status = q.status;
  if (!q.month && !q.date && !q.employeeId && !q.status) throw new ApiError(400, "Give a month, a date, an employeeId or a status");
  return db
    .collection<AttendanceRecord>(COLLECTIONS.attendance)
    .find(filter, { projection: { source: 0, legacy: 0 } })
    .sort({ date: -1, empCode: 1 })
    .limit(5000)
    .toArray();
}

// ---------- writes ----------

export async function createAttendance(input: z.infer<typeof attendanceInput>, actor: Actor) {
  const db = await getDb();
  const month = input.date.slice(0, 7);
  await assertMonthOpen(month);
  const emp = await db.collection<Employee>(COLLECTIONS.employees).findOne({ _id: input.employeeId });
  if (!emp) throw notFound("Employee");

  const pausedSeconds = input.pausedMinutes * 60;
  const { calc, status } = compute(emp, input.date, input.inTime, input.outTime, pausedSeconds);
  const now = new Date();
  const doc: AttendanceRecord = {
    _id: `${input.date}_${emp._id}`,
    employeeId: emp._id,
    empCode: emp.empCode,
    date: input.date,
    month,
    inTime: input.inTime,
    outTime: input.outTime,
    pausedSeconds,
    status,
    calc,
    syncedToSheet: false,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.collection<AttendanceRecord>(COLLECTIONS.attendance).insertOne(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new ApiError(409, `${emp.empCode} already has a record on ${input.date}. Edit it instead.`);
    throw err;
  }
  await logChange(actor, { action: "attendance.create", entity: "attendance", entityId: doc._id, reason: input.reason, changes: diff(null, doc) });
  return doc;
}

export async function correctAttendance(id: string, patch: z.infer<typeof attendancePatch>, actor: Actor) {
  const db = await getDb();
  const col = db.collection<AttendanceRecord>(COLLECTIONS.attendance);
  const before = await col.findOne({ _id: id });
  if (!before) throw notFound("Attendance record");
  await assertMonthOpen(before.month);
  const emp = await db.collection<Employee>(COLLECTIONS.employees).findOne({ _id: before.employeeId });

  const inTime = patch.inTime ?? before.inTime;
  const outTime = patch.outTime !== undefined ? patch.outTime : before.outTime;
  const pausedSeconds = patch.pausedMinutes !== undefined ? patch.pausedMinutes * 60 : before.pausedSeconds;
  const { calc, status } = compute(emp ?? { breakMinutes: 30 }, before.date, inTime, outTime, pausedSeconds);

  const after = await col.findOneAndUpdate(
    { _id: id },
    { $set: { inTime, outTime, pausedSeconds, calc, status, updatedAt: new Date() } },
    { returnDocument: "after", projection: { source: 0, legacy: 0 } },
  );
  await logChange(actor, { action: "attendance.correct", entity: "attendance", entityId: id, reason: patch.reason, changes: diff(before, after) });
  return after!;
}

export async function deleteAttendance(id: string, reason: string, actor: Actor) {
  const db = await getDb();
  const col = db.collection<AttendanceRecord>(COLLECTIONS.attendance);
  const before = await col.findOne({ _id: id });
  if (!before) throw notFound("Attendance record");
  await assertMonthOpen(before.month);
  await col.deleteOne({ _id: id });
  await logChange(actor, { action: "attendance.delete", entity: "attendance", entityId: id, reason, changes: diff(before, null) });
  return { deleted: id };
}
