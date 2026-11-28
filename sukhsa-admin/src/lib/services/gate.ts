import "server-only";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type AttendanceRecord, type Employee } from "@/lib/schema";
import { ApiError, notFound, type Actor } from "@/lib/api/errors";
import { todayIST } from "@/lib/dates";
import { compute } from "./attendance";
import { assertMonthOpen } from "./locks";
import { logChange } from "./audit";

/**
 * Guard Gate Desk (spec §4.5). One attendance record per employee per day.
 *   In     -> inTime, startedAtMs, isPaused=false, pausedSeconds=0, status "on_duty", outTime=null
 *   Pause  -> isPaused=true, pausedAtMs=now                       ("Stop Timing")
 *   Resume -> pausedSeconds += floor((now - pausedAtMs)/1000)     ("Start Timing")
 *   Out    -> (auto-resume if paused) outTime, full payroll calculation, final status
 * A shift that started yesterday and is still open can be closed today (overnight).
 */

export type GateAction = "in" | "pause" | "resume" | "out";
export type GateState = "not_in" | "on_duty" | "paused" | "done";

/** "HH:MM" in India time. */
function nowHHMM(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}
function yesterday(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return t.toISOString().slice(0, 10);
}

export interface GateRow {
  employeeId: string;
  empCode: string;
  name: string;
  department: string;
  category: "permanent" | "temporary";
  state: GateState;
  record: {
    _id: string;
    date: string;
    inTime: string;
    outTime: string | null;
    pausedSeconds: number;
    startedAtMs: number | null;
    isPaused: boolean;
    pausedAtMs: number | null;
    netMinutes: number | null;
    status: string;
  } | null;
}

/** Everything the Gate Desk screen shows: active employees and their shift for today. */
/** `onlyEmployeeIds` limits the board to a team (supervisors). */
export async function gateBoard(onlyEmployeeIds?: string[]) {
  const db = await getDb();
  const today = todayIST();
  const [employees, recs] = await Promise.all([
    db.collection<Employee>(COLLECTIONS.employees).find(onlyEmployeeIds ? { active: true, _id: { $in: onlyEmployeeIds } } : { active: true }, { projection: { empCode: 1, name: 1, department: 1, category: 1 } }).sort({ empCode: 1 }).toArray(),
    db
      .collection<AttendanceRecord>(COLLECTIONS.attendance)
      // today's records, plus yesterday's still-open shifts (overnight)
      .find({ $or: [{ date: today }, { date: yesterday(today), outTime: null }] }, { projection: { source: 0, legacy: 0 } })
      .toArray(),
  ]);
  // Prefer an open shift; otherwise today's record.
  const byEmp = new Map<string, AttendanceRecord>();
  for (const r of recs) {
    const cur = byEmp.get(r.employeeId);
    if (!cur || (!r.outTime && cur.outTime)) byEmp.set(r.employeeId, r);
  }

  const rows: GateRow[] = employees.map((e) => {
    const r = byEmp.get(e._id);
    const state: GateState = !r ? "not_in" : r.outTime ? "done" : r.isPaused ? "paused" : "on_duty";
    return {
      employeeId: e._id,
      empCode: e.empCode,
      name: e.name,
      department: e.department,
      category: e.category,
      state,
      record: r
        ? {
            _id: r._id,
            date: r.date,
            inTime: r.inTime,
            outTime: r.outTime,
            pausedSeconds: r.pausedSeconds ?? 0,
            startedAtMs: r.startedAtMs ?? null,
            isPaused: !!r.isPaused,
            pausedAtMs: r.pausedAtMs ?? null,
            netMinutes: r.calc?.netMinutes ?? null,
            status: r.status,
          }
        : null,
    };
  });
  const count = (s: GateState) => rows.filter((r) => r.state === s).length;
  return { today, serverNowMs: Date.now(), rows, counts: { total: rows.length, inside: count("on_duty"), paused: count("paused"), done: count("done"), notIn: count("not_in") } };
}

export async function gateAction(employeeId: string, action: GateAction, actor: Actor) {
  const db = await getDb();
  const att = db.collection<AttendanceRecord>(COLLECTIONS.attendance);
  const emp = await db.collection<Employee>(COLLECTIONS.employees).findOne({ _id: employeeId });
  if (!emp) throw notFound("Employee");
  if (!emp.active) throw new ApiError(400, `${emp.name} is inactive`);
  if (actor.role === "supervisor" && emp.supervisorId !== actor.id) throw new ApiError(403, `${emp.name} is not in your team`);

  const now = Date.now();
  const today = todayIST();
  const open = await att.findOne({ employeeId, outTime: null, date: { $in: [today, yesterday(today)] } }, { sort: { date: -1 } });

  if (action === "in") {
    if (open) throw new ApiError(409, `${emp.name} is already inside since ${open.inTime}`);
    await assertMonthOpen(today.slice(0, 7));
    const doc: AttendanceRecord = {
      _id: `${today}_${emp._id}`,
      employeeId: emp._id,
      empCode: emp.empCode,
      date: today,
      month: today.slice(0, 7),
      inTime: nowHHMM(),
      outTime: null,
      pausedSeconds: 0,
      status: "on_duty",
      startedAtMs: now,
      isPaused: false,
      pausedAtMs: null,
      calc: null,
      syncedToSheet: false,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
    try {
      await att.insertOne(doc);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw new ApiError(409, `${emp.name} already has a finished shift today. An Admin can correct it in Attendance.`);
      throw err;
    }
    await logChange(actor, { action: "gate.in", entity: "attendance", entityId: doc._id, changes: { in: { from: null, to: doc.inTime } } });
    return { state: "on_duty" as const, record: doc };
  }

  if (!open) throw new ApiError(409, `${emp.name} is not marked In`);
  await assertMonthOpen(open.month);

  if (action === "pause") {
    if (open.isPaused) throw new ApiError(409, `${emp.name} is already on a break`);
    await att.updateOne({ _id: open._id }, { $set: { isPaused: true, pausedAtMs: now, updatedAt: new Date(now) } });
    await logChange(actor, { action: "gate.pause", entity: "attendance", entityId: open._id, changes: { pausedAt: { from: null, to: nowHHMM() } } });
    return { state: "paused" as const };
  }

  // Resume, and Out while paused, both close the running pause first.
  const addSeconds = open.isPaused && open.pausedAtMs ? Math.max(0, Math.floor((now - open.pausedAtMs) / 1000)) : 0;
  const pausedSeconds = (open.pausedSeconds ?? 0) + addSeconds;

  if (action === "resume") {
    if (!open.isPaused) throw new ApiError(409, `${emp.name} is not on a break`);
    await att.updateOne({ _id: open._id }, { $set: { isPaused: false, pausedAtMs: null, pausedSeconds, updatedAt: new Date(now) } });
    await logChange(actor, { action: "gate.resume", entity: "attendance", entityId: open._id, changes: { "away (min)": { from: Math.round((open.pausedSeconds ?? 0) / 60), to: Math.round(pausedSeconds / 60) } } });
    return { state: "on_duty" as const };
  }

  // out
  const outTime = nowHHMM();
  const { calc, status } = compute(emp, open.date, open.inTime, outTime, pausedSeconds);
  await att.updateOne(
    { _id: open._id },
    { $set: { outTime, pausedSeconds, isPaused: false, pausedAtMs: null, calc, status, updatedAt: new Date(now) } },
  );
  await logChange(actor, { action: "gate.out", entity: "attendance", entityId: open._id, changes: { out: { from: null, to: outTime }, "net (min)": { from: null, to: calc?.netMinutes ?? 0 } } });
  return { state: "done" as const, netMinutes: calc?.netMinutes ?? 0, status };
}
