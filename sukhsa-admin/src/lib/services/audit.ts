import "server-only";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type AuditEntry } from "@/lib/schema";
import type { Actor } from "@/lib/api/errors";

const IGNORE = new Set(["_id", "updatedAt", "createdAt", "source", "legacy"]);

/** Field-by-field differences between two versions of a record. */
export function diff(before: object | null | undefined, after: object | null | undefined) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (IGNORE.has(k)) continue;
    if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) out[k] = { from: b[k] ?? null, to: a[k] ?? null };
  }
  return out;
}

export async function logChange(
  actor: Actor,
  entry: Omit<AuditEntry, "_id" | "at" | "actor">,
): Promise<void> {
  const db = await getDb();
  await db.collection<AuditEntry>(COLLECTIONS.auditLog).insertOne({
    at: new Date(),
    actor: { id: actor.id, email: actor.email, role: actor.role },
    ...entry,
  });
}

export async function listAudit(filter: { entity?: AuditEntry["entity"]; entityId?: string; limit?: number }) {
  const db = await getDb();
  const q: Record<string, unknown> = {};
  if (filter.entity) q.entity = filter.entity;
  if (filter.entityId) q.entityId = filter.entityId;
  return db
    .collection<AuditEntry>(COLLECTIONS.auditLog)
    .find(q)
    .sort({ at: -1 })
    .limit(Math.min(filter.limit ?? 50, 200))
    .toArray();
}
