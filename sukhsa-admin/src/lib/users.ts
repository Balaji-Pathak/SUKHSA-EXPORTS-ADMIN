import "server-only";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type User } from "@/lib/schema";
import { PANEL_ROLES, type PanelRole } from "@/lib/access";

export interface PanelUser {
  id: string;
  email: string;
  role: PanelRole;
  displayName?: string;
}

/**
 * The approved-user check. Someone may use the web panel only if their email is in
 * sukhsa_central.users, the account is active, and the role is super_admin / admin / supervisor.
 */
export async function findPanelUser(email: string | null | undefined): Promise<PanelUser | null> {
  if (!email) return null;
  const db = await getDb();
  const u = await db.collection<User>(COLLECTIONS.users).findOne({
    email: email.trim().toLowerCase(),
    active: true,
    role: { $in: PANEL_ROLES },
  });
  if (!u || !u.email) return null;
  return { id: u._id, email: u.email, role: u.role as PanelRole, displayName: u.displayName };
}

/** Record the latest sign-in (and the Google display name, if we don't have one yet). */
export async function recordSignIn(email: string, name?: string | null) {
  const db = await getDb();
  await db.collection<User>(COLLECTIONS.users).updateOne(
    { email: email.trim().toLowerCase() },
    [
      {
        $set: {
          lastLoginAt: "$$NOW",
          updatedAt: "$$NOW",
          displayName: { $ifNull: ["$displayName", name ?? null] },
        },
      },
    ],
  );
}
