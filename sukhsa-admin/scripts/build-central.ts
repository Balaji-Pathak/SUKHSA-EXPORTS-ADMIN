/**
 * Build the central database (MONGODB_DB, e.g. sukhsa_central) from the Firestore mirror.
 *
 *   npm run central:build
 *
 * - Creates collections with validators and indexes (src/lib/schema.ts).
 * - Cleans and reshapes the data: employees, attendance (payroll recomputed with
 *   src/lib/payroll.ts), monthly_theka, users (admins + guards with roles), settings.
 * - Reads ONLY from the mirror. Firestore and the live attendance app are not touched.
 * - Safe to re-run while Firestore is still the live system. After cutover (when the
 *   attendance app writes to the new APIs), the settings doc { _id: "cutover" } blocks it,
 *   so it can never overwrite data entered in the new system.
 */
import type { Db, Document } from "mongodb";
import { openMirror, requireEnv, writeReport } from "./lib/common";
import { calculateDay, PayrollInputError } from "../src/lib/payroll";
import {
  COLLECTIONS,
  ensureSchema,
  type AttendanceRecord,
  type Employee,
  type EmployeeCategory,
  type MonthlyTheka,
  type SourceRef,
  type User,
} from "../src/lib/schema";

const now = new Date();
const src = (collection: string, id: string): SourceRef => ({ system: "firestore", collection, id, importedAt: now });
const asDate = (v: unknown): Date => (v instanceof Date ? v : now);
const asNum = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function categoryFrom(label: unknown): EmployeeCategory {
  const s = String(label ?? "").toLowerCase();
  if (s.includes("temporary")) return "temporary";
  if (s.includes("permanent")) return "permanent";
  throw new Error(`Unknown companyCategory "${label}"`);
}

async function upsertAll<T extends { _id: string }>(db: Db, name: string, docs: T[]) {
  if (!docs.length) return;
  await db.collection<T>(name).bulkWrite(
    docs.map((d) => {
      const { _id, ...rest } = d;
      return { replaceOne: { filter: { _id } as never, replacement: rest as never, upsert: true } };
    }),
    { ordered: false },
  );
}

async function main() {
  const centralName = requireEnv("MONGODB_DB");
  const { client, mirror } = await openMirror();
  const central = client.db(centralName);

  if (await central.collection(COLLECTIONS.settings).findOne({ _id: "cutover" as never })) {
    console.error(`"${centralName}" is marked as cut over (settings._id = "cutover"). Refusing to overwrite it from Firestore.`);
    process.exit(1);
  }

  console.log(`Building "${centralName}" from "${mirror.databaseName}"...\n`);
  await ensureSchema(central);

  const problems: string[] = [];

  // ---------- employees + monthly theka ----------
  const mEmployees = await mirror.collection("employees").find().toArray();
  const employees: Employee[] = [];
  const theka: MonthlyTheka[] = [];
  for (const e of mEmployees) {
    const id = String(e._id);
    try {
      const sheets =
        e.individualSheetId || e.individualSheetUrl
          ? { individualSheetId: e.individualSheetId, individualSheetUrl: e.individualSheetUrl }
          : undefined;
      employees.push({
        _id: id,
        empCode: String(e.empCode).trim(),
        name: String(e.name).trim(),
        department: String(e.department ?? "").trim(),
        category: categoryFrom(e.companyCategory),
        companyCategory: String(e.companyCategory),
        hourlyRate: asNum(e.hourlyRate),
        breakMinutes: asNum(e.breakMinutes, 30),
        active: e.active !== false,
        ...(sheets ? { sheets } : {}),
        createdAt: asDate(e._fs?.createTime),
        updatedAt: asDate(e._fs?.updateTime),
        source: src("employees", id),
      });
      for (const [month, minutes] of Object.entries((e.monthlyThikadaMinutes ?? {}) as Record<string, unknown>)) {
        theka.push({ _id: `${id}_${month}`, employeeId: id, month, thekaMinutes: asNum(minutes), updatedAt: now });
      }
    } catch (err) {
      problems.push(`employee ${id}: ${(err as Error).message}`);
    }
  }
  await upsertAll(central, COLLECTIONS.employees, employees);
  await upsertAll(central, COLLECTIONS.monthlyTheka, theka);
  const empById = new Map(employees.map((e) => [e._id, e]));

  // ---------- attendance (payroll recomputed) ----------
  const LEGACY_FIELDS = [
    "grossMinutes", "breakMinutes", "netMinutes", "netDecimalHours", "overtimeMinutes", "overtimeDecimalHours",
    "normalMinutes", "normalDecimalHours", "presentCount", "thikadaMinutes", "isSunday", "isPaused", "pausedAtMs", "startedAtMs",
  ];
  const mAttendance = await mirror.collection("attendance").find().toArray();
  const attendance: AttendanceRecord[] = [];
  const diffs = { gross: 0, net: 0, h: 0, present: 0, open: 0, orphan: 0, staleCode: 0 };
  for (const a of mAttendance) {
    const id = String(a._id);
    const employeeId = String(a.empId);
    const emp = empById.get(employeeId);
    if (!emp) {
      diffs.orphan++;
      problems.push(`attendance ${id}: employee ${employeeId} not found`);
    }
    const legacy: Document = {};
    for (const f of LEGACY_FIELDS) if (a[f] !== undefined) legacy[f] = a[f];
    if (emp && a.empCode && a.empCode !== emp.empCode) {
      legacy.empCode = a.empCode; // stale code stored by the old app
      diffs.staleCode++;
    }

    let calc: AttendanceRecord["calc"] = null;
    if (a.outTime) {
      try {
        calc = calculateDay({
          date: a.date,
          inTime: a.inTime,
          outTime: a.outTime,
          pausedSeconds: asNum(a.pausedTotalSeconds),
          breakMinutes: emp?.breakMinutes,
        });
        if (calc.grossMinutes !== legacy.grossMinutes) diffs.gross++;
        if (calc.netMinutes !== legacy.netMinutes) diffs.net++;
        const legacyH = asNum(legacy.normalMinutes) + asNum(legacy.overtimeMinutes);
        if (calc.hMinutes !== legacyH) diffs.h++;
        const legacyPresent = legacy.presentCount ?? (calc.isSunday ? 0 : asNum(legacy.netMinutes) >= 480 ? 1 : 0);
        if (calc.presentDays !== legacyPresent) diffs.present++;
      } catch (err) {
        if (!(err instanceof PayrollInputError)) throw err;
        problems.push(`attendance ${id}: ${err.message}`);
      }
    } else {
      diffs.open++;
    }

    attendance.push({
      _id: id,
      employeeId,
      // Always the employee's CURRENT code; attendance links by employeeId, never by code.
      empCode: emp?.empCode ?? String(a.empCode ?? ""),
      date: String(a.date),
      month: String(a.date).slice(0, 7),
      inTime: String(a.inTime),
      outTime: a.outTime ? String(a.outTime) : null,
      pausedSeconds: asNum(a.pausedTotalSeconds),
      status: String(a.status ?? (a.outTime ? "completed" : "open")),
      calc,
      legacy,
      syncedToSheet: a.syncedToSheet === true,
      createdAt: asDate(a.createdAt),
      updatedAt: asDate(a.updatedAt),
      source: src("attendance", id),
    });
  }
  await upsertAll(central, COLLECTIONS.attendance, attendance);

  // ---------- users: admins + guards ----------
  const superAdmins = new Set(
    (process.env.SUPER_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  const users: User[] = [];
  for (const a of await mirror.collection("admin_emails").find().toArray()) {
    const email = String(a.email ?? a._id).trim().toLowerCase();
    users.push({
      _id: `admin:${email}`,
      role: superAdmins.has(email) ? "super_admin" : "admin",
      email,
      active: true,
      ...(a.addedBy ? { addedBy: String(a.addedBy) } : {}),
      createdAt: asDate(a.createdAt),
      updatedAt: now,
      source: src("admin_emails", String(a._id)),
    });
  }
  for (const email of superAdmins) {
    if (!users.some((u) => u.email === email)) {
      users.push({ _id: `admin:${email}`, role: "super_admin", email, active: true, createdAt: now, updatedAt: now });
    }
  }
  for (const g of await mirror.collection("guards").find().toArray()) {
    const username = String(g.username).trim().toLowerCase();
    users.push({
      _id: `guard:${username}`,
      role: "guard",
      username,
      ...(g.displayName ? { displayName: String(g.displayName) } : {}),
      passwordHash: String(g.passwordHash),
      active: g.active !== false,
      ...(g.createdBy ? { addedBy: String(g.createdBy) } : {}),
      createdAt: asDate(g.createdAt),
      updatedAt: asDate(g.updatedAt),
      source: src("guards", String(g._id)),
    });
  }
  await upsertAll(central, COLLECTIONS.users, users);

  // ---------- auth salts + settings (copied as-is) ----------
  const copyAsIs = async (from: string, to: string) => {
    const docs = await mirror.collection(from).find().toArray();
    await upsertAll(
      central,
      to,
      docs.map(({ _id, _fs, ...rest }) => ({ _id: String(_id), ...rest, source: src(from, String(_id)) })),
    );
    return docs.length;
  };
  const salts = await copyAsIs("guard_salts", COLLECTIONS.authSalts);
  const settings = await copyAsIs("settings", COLLECTIONS.settings);

  const counts = {
    employees: employees.length,
    attendance: attendance.length,
    monthly_theka: theka.length,
    users: users.length,
    auth_salts: salts,
    settings,
  };
  console.table(counts);
  console.log("Users by role:", users.reduce<Record<string, number>>((m, u) => ((m[u.role] = (m[u.role] ?? 0) + 1), m), {}));
  console.log("\nPayroll recompute vs values stored by the old app:");
  console.table({
    "gross minutes differ": diffs.gross,
    "net minutes differ": diffs.net,
    "H minutes differ": diffs.h,
    "Present differs": diffs.present,
    "open shifts (no out time)": diffs.open,
    "attendance with unknown employee": diffs.orphan,
    "old app stored a stale empCode": diffs.staleCode,
  });
  if (problems.length) console.log("\nProblems:\n - " + problems.join("\n - "));
  const file = writeReport("central-build", { db: centralName, counts, diffs, problems, finishedAt: new Date().toISOString() });
  console.log(`\nReport saved to ${file}`);
  await client.close();
}

main().catch((err) => {
  console.error("Central build failed:", err);
  process.exit(1);
});
