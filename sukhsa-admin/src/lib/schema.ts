/**
 * Central database (sukhsa_central) schema: collection names, document types,
 * MongoDB validators and indexes. Every ERP module links to employees by employeeId.
 */
import type { CreateIndexesOptions, Db, Document, IndexSpecification } from "mongodb";

export const COLLECTIONS = {
  employees: "employees",
  attendance: "attendance",
  monthlyTheka: "monthly_theka",
  users: "users",
  authSalts: "auth_salts",
  settings: "settings",
} as const;

export type EmployeeCategory = "permanent" | "temporary";
export type UserRole = "super_admin" | "admin" | "supervisor" | "guard";

/** Where a record came from, so it can always be traced back to the old system. */
export interface SourceRef {
  system: "firestore";
  collection: string;
  id: string;
  importedAt: Date;
}

export interface Employee {
  /** employeeId, e.g. "emp-1795517932086" (kept from the attendance app). */
  _id: string;
  empCode: string;
  name: string;
  department: string;
  category: EmployeeCategory;
  /** Original label, e.g. "Sukhsa Export Permanent". */
  companyCategory: string;
  hourlyRate: number;
  breakMinutes: number;
  active: boolean;
  sheets?: { individualSheetId?: string; individualSheetUrl?: string };
  createdAt: Date;
  updatedAt: Date;
  source?: SourceRef;
}

export interface AttendanceRecord {
  /** "<date>_<employeeId>", same id format as the attendance app: one record per employee per day. */
  _id: string;
  employeeId: string;
  empCode: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  inTime: string; // HH:MM
  outTime: string | null;
  pausedSeconds: number;
  status: string;
  /** Computed with src/lib/payroll.ts. Null while the shift is still open. */
  calc: {
    isSunday: boolean;
    grossMinutes: number;
    breakMinutes: number;
    netMinutes: number;
    presentDays: 0 | 1;
    hMinutes: number;
  } | null;
  /** Values the old app stored, kept for comparison only. */
  legacy?: Record<string, unknown>;
  syncedToSheet: boolean;
  createdAt: Date;
  updatedAt: Date;
  source?: SourceRef;
}

export interface MonthlyTheka {
  _id: string; // "<employeeId>_<YYYY-MM>"
  employeeId: string;
  month: string;
  thekaMinutes: number;
  updatedAt: Date;
}

export interface User {
  _id: string; // "admin:<email>" or "guard:<username>"
  role: UserRole;
  displayName?: string;
  email?: string; // admins sign in with Google
  username?: string; // guards sign in with username + password
  passwordHash?: string; // PBKDF2-SHA256, copied unchanged from the attendance app
  active: boolean;
  addedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  source?: SourceRef;
}

const str = { bsonType: "string" };
const num = { bsonType: ["int", "long", "double", "decimal"] };
const date = { bsonType: "date" };

/** Validators reject malformed writes from any future API or script. */
export const VALIDATORS: Record<string, Document> = {
  [COLLECTIONS.employees]: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "empCode", "name", "category", "hourlyRate", "breakMinutes", "active", "createdAt", "updatedAt"],
      properties: {
        _id: str,
        empCode: { bsonType: "string", minLength: 1 },
        name: { bsonType: "string", minLength: 1 },
        department: str,
        category: { enum: ["permanent", "temporary"] },
        hourlyRate: { ...num, minimum: 0 },
        breakMinutes: { ...num, minimum: 0 },
        active: { bsonType: "bool" },
        createdAt: date,
        updatedAt: date,
      },
    },
  },
  [COLLECTIONS.attendance]: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "employeeId", "date", "month", "inTime", "createdAt", "updatedAt"],
      properties: {
        employeeId: str,
        date: { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        month: { bsonType: "string", pattern: "^\\d{4}-\\d{2}$" },
        inTime: { bsonType: "string", pattern: "^\\d{1,2}:\\d{2}$" },
        outTime: { bsonType: ["string", "null"] },
        pausedSeconds: { ...num, minimum: 0 },
      },
    },
  },
  [COLLECTIONS.monthlyTheka]: {
    $jsonSchema: {
      bsonType: "object",
      required: ["employeeId", "month", "thekaMinutes"],
      properties: {
        employeeId: str,
        month: { bsonType: "string", pattern: "^\\d{4}-\\d{2}$" },
        thekaMinutes: { ...num, minimum: 0 },
      },
    },
  },
  [COLLECTIONS.users]: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "role", "active", "createdAt", "updatedAt"],
      properties: {
        role: { enum: ["super_admin", "admin", "supervisor", "guard"] },
        email: str,
        username: str,
        active: { bsonType: "bool" },
      },
    },
  },
};

export const INDEXES: Record<string, [IndexSpecification, CreateIndexesOptions][]> = {
  [COLLECTIONS.employees]: [
    [{ empCode: 1 }, { unique: true, name: "empCode_unique" }],
    [{ active: 1, category: 1 }, { name: "active_category" }],
  ],
  [COLLECTIONS.attendance]: [
    [{ employeeId: 1, date: 1 }, { unique: true, name: "employee_date_unique" }],
    [{ month: 1, employeeId: 1 }, { name: "month_employee" }],
    [{ date: 1 }, { name: "date" }],
  ],
  [COLLECTIONS.monthlyTheka]: [[{ employeeId: 1, month: 1 }, { unique: true, name: "employee_month_unique" }]],
  [COLLECTIONS.users]: [
    [{ email: 1 }, { unique: true, name: "email_unique", partialFilterExpression: { email: { $type: "string" } } }],
    [{ username: 1 }, { unique: true, name: "username_unique", partialFilterExpression: { username: { $type: "string" } } }],
    [{ role: 1 }, { name: "role" }],
  ],
};

/** Create collections (with validators) and indexes. Safe to run repeatedly. */
export async function ensureSchema(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of Object.values(COLLECTIONS)) {
    const validator = VALIDATORS[name];
    if (!existing.has(name)) {
      await db.createCollection(name, validator ? { validator, validationLevel: "strict", validationAction: "error" } : {});
    } else if (validator) {
      await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    }
    for (const [spec, opts] of INDEXES[name] ?? []) {
      await db.collection(name).createIndex(spec, opts);
    }
  }
}
