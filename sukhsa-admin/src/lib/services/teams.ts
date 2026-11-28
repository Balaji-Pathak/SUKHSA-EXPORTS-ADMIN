import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type Employee, type User } from "@/lib/schema";
import { ApiError, notFound, type Actor } from "@/lib/api/errors";
import { logChange } from "./audit";

/**
 * Teams: each employee can belong to one supervisor (employees.supervisorId).
 * Supervisors only ever see and act on their own team. Later, work allotment builds on this.
 */

export const teamInput = z.object({ employeeIds: z.array(z.string().min(1)).max(1000) });

export async function listSupervisors() {
  const db = await getDb();
  const [sups, counts] = await Promise.all([
    db.collection<User>(COLLECTIONS.users).find({ role: "supervisor" }, { projection: { email: 1, displayName: 1, active: 1, lastLoginAt: 1 } }).sort({ email: 1 }).toArray(),
    db
      .collection<Employee>(COLLECTIONS.employees)
      .aggregate<{ _id: string; n: number }>([{ $match: { supervisorId: { $type: "string" }, active: true } }, { $group: { _id: "$supervisorId", n: { $sum: 1 } } }])
      .toArray(),
  ]);
  const n = new Map(counts.map((c) => [c._id, c.n]));
  return sups.map((s) => ({ id: s._id, email: s.email ?? "", name: s.displayName || s.email || s._id, active: s.active, teamSize: n.get(s._id) ?? 0 }));
}

/** Employee ids in a supervisor's team (active employees only). */
export async function teamEmployeeIds(supervisorId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.collection<Employee>(COLLECTIONS.employees).find({ supervisorId, active: true }, { projection: { _id: 1 } }).toArray();
  return rows.map((r) => r._id);
}

/** Replace a supervisor's team with exactly these employees. Employees move from any other team. */
export async function setTeam(supervisorId: string, employeeIds: string[], actor: Actor) {
  const db = await getDb();
  const sup = await db.collection<User>(COLLECTIONS.users).findOne({ _id: supervisorId, role: "supervisor" });
  if (!sup) throw notFound("Supervisor");
  const emps = db.collection<Employee>(COLLECTIONS.employees);
  const found = await emps.countDocuments({ _id: { $in: employeeIds } });
  if (found !== employeeIds.length) throw new ApiError(400, "Some selected employees no longer exist. Refresh and try again.");

  const before = await teamEmployeeIds(supervisorId);
  const now = new Date();
  await emps.updateMany({ supervisorId, _id: { $nin: employeeIds } }, { $set: { supervisorId: null, updatedAt: now } });
  if (employeeIds.length) await emps.updateMany({ _id: { $in: employeeIds } }, { $set: { supervisorId, updatedAt: now } });

  const added = employeeIds.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !employeeIds.includes(id));
  if (added.length || removed.length) {
    await logChange(actor, {
      action: "team.set",
      entity: "user",
      entityId: supervisorId,
      changes: { "team size": { from: before.length, to: employeeIds.length }, added: { from: null, to: added.length }, removed: { from: null, to: removed.length } },
    });
  }
  return { supervisorId, teamSize: employeeIds.length, added: added.length, removed: removed.length };
}
