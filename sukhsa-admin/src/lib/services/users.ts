import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type User } from "@/lib/schema";
import { ApiError, notFound, type Actor } from "@/lib/api/errors";
import { PANEL_ROLES } from "@/lib/access";
import { diff, logChange } from "./audit";

export const userInput = z.object({
  email: z.string().trim().toLowerCase().email("must be a valid email"),
  role: z.enum(["super_admin", "admin", "supervisor"]),
  displayName: z.string().trim().max(80).optional(),
});
export const userPatch = z.object({
  role: z.enum(["super_admin", "admin", "supervisor"]).optional(),
  active: z.boolean().optional(),
  displayName: z.string().trim().max(80).optional(),
});

export async function listPanelUsers() {
  const db = await getDb();
  return db
    .collection<User>(COLLECTIONS.users)
    .find({ role: { $in: PANEL_ROLES } }, { projection: { passwordHash: 0, source: 0 } })
    .sort({ role: 1, email: 1 })
    .toArray();
}

export async function addPanelUser(input: z.infer<typeof userInput>, actor: Actor) {
  const db = await getDb();
  const now = new Date();
  const doc: User = { _id: `admin:${input.email}`, ...input, active: true, addedBy: actor.email, createdAt: now, updatedAt: now };
  try {
    await db.collection<User>(COLLECTIONS.users).insertOne(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new ApiError(409, `${input.email} is already a user`);
    throw err;
  }
  await logChange(actor, { action: "user.add", entity: "user", entityId: doc._id, changes: diff(null, doc) });
  return doc;
}

export async function updatePanelUser(id: string, patch: z.infer<typeof userPatch>, actor: Actor) {
  const db = await getDb();
  const col = db.collection<User>(COLLECTIONS.users);
  const before = await col.findOne({ _id: id, role: { $in: PANEL_ROLES } });
  if (!before) throw notFound("User");
  if (before.email === actor.email && (patch.active === false || (patch.role && patch.role !== before.role))) {
    throw new ApiError(400, "You can't change your own role or deactivate yourself");
  }
  const losingSuper = before.role === "super_admin" && (patch.active === false || (patch.role && patch.role !== "super_admin"));
  if (losingSuper && (await col.countDocuments({ role: "super_admin", active: true })) <= 1) {
    throw new ApiError(400, "There must always be at least one active Super Admin");
  }
  const after = await col.findOneAndUpdate(
    { _id: id },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: "after", projection: { passwordHash: 0, source: 0 } },
  );
  await logChange(actor, { action: "user.update", entity: "user", entityId: id, changes: diff(before, after) });
  return after!;
}
