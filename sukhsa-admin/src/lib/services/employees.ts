import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type Employee, type MonthlyTheka } from "@/lib/schema";
import { ApiError, notFound, type Actor } from "@/lib/api/errors";
import { MONTH_RE } from "@/lib/dates";
import { diff, logChange } from "./audit";
import { assertMonthOpen } from "./locks";

// ---------- validation ----------

export const employeeInput = z.object({
  empCode: z.string().trim().min(1, "required").max(20).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, "required").max(120),
  department: z.string().trim().max(60).default(""),
  category: z.enum(["permanent", "temporary"]),
  // Rates are kept to 2 decimal places: 84.384 -> 84.38, 84.385 -> 84.39.
  hourlyRate: z.coerce
    .number()
    .min(0)
    .max(100000)
    .transform((n) => Math.round((n + Number.EPSILON) * 100) / 100),
  breakMinutes: z.coerce.number().int().min(0).max(240).default(30),
  active: z.boolean().default(true),
});
export const employeePatch = employeeInput.partial();
export type EmployeeInput = z.infer<typeof employeeInput>;

export const thekaInput = z.object({
  month: z.string().regex(MONTH_RE, "use YYYY-MM"),
  hours: z.coerce.number().min(0).max(744),
});

const CATEGORY_LABEL = { permanent: "Sukhsa Export Permanent", temporary: "Sukhsa Export Temporary" } as const;

// ---------- reads ----------

export interface EmployeeFilter {
  q?: string;
  category?: "permanent" | "temporary";
  department?: string;
  active?: boolean;
  /** Only this supervisor's team. */
  supervisorId?: string;
}

export async function listEmployees(f: EmployeeFilter = {}) {
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (f.category) query.category = f.category;
  if (f.department) query.department = f.department;
  if (f.active !== undefined) query.active = f.active;
  if (f.supervisorId) query.supervisorId = f.supervisorId;
  if (f.q?.trim()) {
    const rx = new RegExp(f.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ name: rx }, { empCode: rx }, { department: rx }];
  }
  return db.collection<Employee>(COLLECTIONS.employees).find(query, { projection: { source: 0 } }).sort({ empCode: 1 }).toArray();
}

export async function getEmployee(id: string) {
  const db = await getDb();
  const e = await db.collection<Employee>(COLLECTIONS.employees).findOne({ _id: id }, { projection: { source: 0 } });
  if (!e) throw notFound("Employee");
  return e;
}

export async function listDepartments(): Promise<string[]> {
  const db = await getDb();
  const d = await db.collection<Employee>(COLLECTIONS.employees).distinct("department");
  return (d as string[]).filter(Boolean).sort();
}

/** Suggest the next free code, e.g. EMP-029. */
export async function nextEmpCode(): Promise<string> {
  const db = await getDb();
  const codes = await db.collection<Employee>(COLLECTIONS.employees).distinct("empCode");
  const max = (codes as string[]).reduce((m, c) => Math.max(m, Number(/^EMP-(\d+)$/.exec(c)?.[1] ?? 0)), 0);
  return `EMP-${String(max + 1).padStart(3, "0")}`;
}

export async function getThekaForEmployee(employeeId: string) {
  const db = await getDb();
  return db.collection<MonthlyTheka>(COLLECTIONS.monthlyTheka).find({ employeeId }).sort({ month: -1 }).toArray();
}

// ---------- writes ----------

export async function createEmployee(input: EmployeeInput, actor: Actor) {
  const db = await getDb();
  const now = new Date();
  const doc: Employee = {
    _id: `emp-${Date.now()}${randomInt(100, 999)}`,
    ...input,
    companyCategory: CATEGORY_LABEL[input.category],
    createdAt: now,
    updatedAt: now,
  };
  await db.collection<Employee>(COLLECTIONS.employees).insertOne(doc).catch(codeTaken(input.empCode));
  await logChange(actor, { action: "employee.create", entity: "employee", entityId: doc._id, changes: diff(null, doc) });
  return doc;
}

export async function updateEmployee(id: string, patch: Partial<EmployeeInput>, actor: Actor) {
  const db = await getDb();
  const col = db.collection<Employee>(COLLECTIONS.employees);
  const before = await col.findOne({ _id: id });
  if (!before) throw notFound("Employee");

  const set: Partial<Employee> = { ...patch, updatedAt: new Date() };
  if (patch.category) set.companyCategory = CATEGORY_LABEL[patch.category];
  const after = await col
    .findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: "after", projection: { source: 0 } })
    .catch(codeTaken(patch.empCode ?? before.empCode));
  const changes = diff(before, after);
  if (Object.keys(changes).length) {
    const action = patch.active === false && before.active ? "employee.deactivate" : patch.active === true && !before.active ? "employee.reactivate" : "employee.update";
    await logChange(actor, { action, entity: "employee", entityId: id, changes });
  }
  // empCode is copied onto attendance for display; keep it current.
  if (patch.empCode && patch.empCode !== before.empCode) {
    await db.collection(COLLECTIONS.attendance).updateMany({ employeeId: id }, { $set: { empCode: patch.empCode } });
  }
  return after!;
}

export async function setTheka(employeeId: string, month: string, hours: number, actor: Actor) {
  await getEmployee(employeeId);
  await assertMonthOpen(month);
  const db = await getDb();
  const col = db.collection<MonthlyTheka>(COLLECTIONS.monthlyTheka);
  const _id = `${employeeId}_${month}`;
  const before = await col.findOne({ _id });
  const thekaMinutes = Math.round(hours * 60);
  if (thekaMinutes === 0) {
    await col.deleteOne({ _id });
  } else {
    await col.updateOne({ _id }, { $set: { employeeId, month, thekaMinutes, updatedAt: new Date() } }, { upsert: true });
  }
  if ((before?.thekaMinutes ?? 0) !== thekaMinutes) {
    await logChange(actor, {
      action: "theka.set",
      entity: "theka",
      entityId: employeeId,
      changes: { [`theka ${month} (min)`]: { from: before?.thekaMinutes ?? 0, to: thekaMinutes } },
    });
  }
  return { employeeId, month, thekaMinutes };
}

/** Turn a duplicate-key error into a clear message (spec §4.2: codes are unique among ACTIVE employees). */
function codeTaken(code: string) {
  return (err: unknown): never => {
    if ((err as { code?: number }).code === 11000) {
      throw new ApiError(409, `${code} already belongs to another active employee. Deactivate that employee first or choose another code.`);
    }
    throw err;
  };
}

export const deleteEmployeeInput = z.object({
  confirmCode: z.string({ error: "type the employee code to confirm" }).trim(),
  reason: z.string().trim().max(300).optional(),
});

/**
 * Hard delete (spec §4.3): removes the employee, ALL their attendance and Theka.
 * Requires typing the employee code; blocked if any of their months is locked for payroll.
 * A full snapshot stays in the activity log.
 */
export async function deleteEmployee(id: string, input: z.infer<typeof deleteEmployeeInput>, actor: Actor) {
  const db = await getDb();
  const emp = await db.collection<Employee>(COLLECTIONS.employees).findOne({ _id: id });
  if (!emp) throw notFound("Employee");
  if (input.confirmCode.toUpperCase() !== emp.empCode.toUpperCase()) {
    throw new ApiError(400, `Type ${emp.empCode} exactly to confirm deleting ${emp.name}`);
  }
  const months = (await db.collection(COLLECTIONS.attendance).distinct("month", { employeeId: id })) as string[];
  for (const m of months) await assertMonthOpen(m);

  const [att, theka] = await Promise.all([
    db.collection(COLLECTIONS.attendance).deleteMany({ employeeId: id }),
    db.collection(COLLECTIONS.monthlyTheka).deleteMany({ employeeId: id }),
  ]);
  await db.collection<Employee>(COLLECTIONS.employees).deleteOne({ _id: id });
  await logChange(actor, {
    action: "employee.delete",
    entity: "employee",
    entityId: id,
    reason: input.reason,
    changes: {
      ...diff(emp, null),
      "attendance records deleted": { from: att.deletedCount, to: 0 },
      "theka months deleted": { from: theka.deletedCount, to: 0 },
    },
  });
  return { deleted: id, attendanceDeleted: att.deletedCount, thekaDeleted: theka.deletedCount };
}
