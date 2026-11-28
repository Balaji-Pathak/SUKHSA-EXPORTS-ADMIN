import "server-only";
import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type User } from "@/lib/schema";
import { ApiError, notFound, type Actor } from "@/lib/api/errors";
import { diff, logChange } from "./audit";

/**
 * Guard accounts (spec §6): username + password, created and managed by Admins.
 * Passwords use exactly the attendance app's scheme, so existing guards keep their passwords:
 *   PBKDF2-SHA256, 100,000 iterations, salt = UTF-8("gatelog:" + saltHex), 32-byte key, hex.
 */
const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 100_000;
const MAX_FAILED = 8;
const LOCK_MINUTES = 15;

export const USERNAME_RE = /^[a-zA-Z0-9_-]{3,40}$/;
export const normalizeUsername = (raw: string) => raw.trim().toLowerCase();

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await pbkdf2Async(Buffer.from(password, "utf8"), Buffer.from(`gatelog:${saltHex}`, "utf8"), ITERATIONS, 32, "sha256");
  return key.toString("hex");
}

async function saltFor(u: User): Promise<string | null> {
  if (u.passwordSalt) return u.passwordSalt;
  const db = await getDb();
  const legacy = await db.collection<{ _id: string; salt?: string }>(COLLECTIONS.authSalts).findOne({ _id: u.username! });
  return legacy?.salt ?? null;
}

const passwordRule = z.string().min(6, "at least 6 characters").max(100);

export const guardInput = z.object({
  username: z.string().trim().regex(USERNAME_RE, "3–40 letters, numbers, - or _").transform(normalizeUsername),
  displayName: z.string().trim().max(60).optional(),
  password: passwordRule,
});
export const guardPatch = z.object({
  displayName: z.string().trim().max(60).optional(),
  active: z.boolean().optional(),
  password: passwordRule.optional(),
});

export interface GuardIdentity {
  id: string;
  username: string;
  name: string;
}

/** Check a guard's username + password. Locks the account for 15 minutes after 8 wrong attempts. */
export async function verifyGuard(usernameRaw: string, password: string): Promise<GuardIdentity | null> {
  const username = normalizeUsername(usernameRaw);
  if (!USERNAME_RE.test(username) || !password) return null;
  const db = await getDb();
  const col = db.collection<User>(COLLECTIONS.users);
  const u = await col.findOne({ role: "guard", username, active: true });
  if (!u?.passwordHash) {
    await hashPassword(password, "0".repeat(32)); // same timing whether or not the user exists
    return null;
  }
  if (u.lockedUntil && u.lockedUntil > new Date()) return null;

  const salt = await saltFor(u);
  const ok = !!salt && (await (async () => {
    const got = Buffer.from(await hashPassword(password, salt), "hex");
    const want = Buffer.from(u.passwordHash!, "hex");
    return got.length === want.length && timingSafeEqual(got, want);
  })());

  if (!ok) {
    const failed = (u.failedLogins ?? 0) + 1;
    await col.updateOne(
      { _id: u._id },
      { $set: failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: failed } },
    );
    return null;
  }
  await col.updateOne({ _id: u._id }, { $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  return { id: u._id, username, name: u.displayName || username };
}

/** Is this guard still allowed in? (re-checked every few minutes while signed in) */
export async function guardStillActive(id: string): Promise<GuardIdentity | null> {
  const db = await getDb();
  const u = await db.collection<User>(COLLECTIONS.users).findOne({ _id: id, role: "guard", active: true });
  return u ? { id: u._id, username: u.username!, name: u.displayName || u.username! } : null;
}

export async function listGuards() {
  const db = await getDb();
  return db
    .collection<User>(COLLECTIONS.users)
    .find({ role: "guard" }, { projection: { passwordHash: 0, passwordSalt: 0, source: 0 } })
    .sort({ username: 1 })
    .toArray();
}

export async function createGuard(input: z.infer<typeof guardInput>, actor: Actor) {
  const db = await getDb();
  const salt = randomBytes(16).toString("hex");
  const now = new Date();
  const doc: User = {
    _id: `guard:${input.username}`,
    role: "guard",
    username: input.username,
    displayName: input.displayName || input.username,
    passwordHash: await hashPassword(input.password, salt),
    passwordSalt: salt,
    active: true,
    addedBy: actor.email,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.collection<User>(COLLECTIONS.users).insertOne(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new ApiError(409, `Username "${input.username}" is already taken`);
    throw err;
  }
  await logChange(actor, { action: "guard.create", entity: "guard", entityId: doc._id, changes: { username: { from: null, to: doc.username }, displayName: { from: null, to: doc.displayName } } });
  return { id: doc._id, username: doc.username };
}

export async function updateGuard(id: string, patch: z.infer<typeof guardPatch>, actor: Actor) {
  const db = await getDb();
  const col = db.collection<User>(COLLECTIONS.users);
  const before = await col.findOne({ _id: id, role: "guard" });
  if (!before) throw notFound("Guard");
  const set: Partial<User> = { updatedAt: new Date() };
  if (patch.displayName !== undefined) set.displayName = patch.displayName;
  if (patch.active !== undefined) set.active = patch.active;
  if (patch.password) {
    set.passwordSalt = randomBytes(16).toString("hex");
    set.passwordHash = await hashPassword(patch.password, set.passwordSalt);
    set.failedLogins = 0;
    set.lockedUntil = null;
  }
  await col.updateOne({ _id: id }, { $set: set });
  const changes = diff({ displayName: before.displayName, active: before.active }, { displayName: set.displayName ?? before.displayName, active: set.active ?? before.active });
  if (patch.password) changes.password = { from: "••••", to: "changed" };
  await logChange(actor, { action: "guard.update", entity: "guard", entityId: id, changes });
  return { id };
}

export async function deleteGuard(id: string, actor: Actor) {
  const db = await getDb();
  const res = await db.collection<User>(COLLECTIONS.users).deleteOne({ _id: id, role: "guard" });
  if (!res.deletedCount) throw notFound("Guard");
  await logChange(actor, { action: "guard.delete", entity: "guard", entityId: id });
  return { deleted: id };
}
