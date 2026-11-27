/**
 * Shared helpers for the Firestore -> MongoDB migration scripts.
 * These scripts only READ from Firestore. Nothing here writes, updates or deletes in Firebase.
 */
import { config } from "dotenv";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  DocumentReference,
  GeoPoint,
  type Firestore,
  type DocumentSnapshot,
} from "firebase-admin/firestore";
import { MongoClient, type Db, type Document } from "mongodb";

config({ path: ".env.local" });

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
    process.exit(1);
  }
  return v;
}

// ---------- Firestore (source) ----------

export function openFirestore(): Firestore {
  // Either variable works; GOOGLE_APPLICATION_CREDENTIALS is the standard Google name.
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??= process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const saPath = requireEnv("FIREBASE_SERVICE_ACCOUNT_PATH");
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const databaseId = requireEnv("FIRESTORE_DATABASE_ID");
  const sa = JSON.parse(readFileSync(saPath, "utf8")) as ServiceAccount;
  const app = initializeApp({ credential: cert(sa), projectId });
  return getFirestore(app, databaseId);
}

export function excludedCollections(): Set<string> {
  return new Set(
    (process.env.MIGRATE_EXCLUDE ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// ---------- MongoDB (target) ----------

export async function openMirror(): Promise<{ client: MongoClient; mirror: Db }> {
  const uri = requireEnv("MONGODB_URI");
  const mirrorName = requireEnv("MONGODB_MIRROR_DB");
  if (mirrorName === process.env.MONGODB_DB) {
    console.error("MONGODB_MIRROR_DB must be different from MONGODB_DB. The mirror is a raw copy only.");
    process.exit(1);
  }
  const client = await new MongoClient(uri, { appName: "sukhsa-migration" }).connect();
  return { client, mirror: client.db(mirrorName) };
}

/**
 * Firestore path -> MongoDB collection name.
 *   "employees"                -> "employees"
 *   "employees/abc/history"    -> "employees__history"
 */
export function mongoNameFor(collectionPath: string): string {
  return collectionPath
    .split("/")
    .filter((_, i) => i % 2 === 0)
    .join("__");
}

/** Convert Firestore-specific value types into plain MongoDB/BSON values. */
export function toMongo(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof DocumentReference) return { _ref: v.path };
  if (v instanceof GeoPoint) return { type: "Point", coordinates: [v.longitude, v.latitude] };
  if (v instanceof Date || Buffer.isBuffer(v) || v instanceof Uint8Array) return v;
  if (Array.isArray(v)) return v.map(toMongo);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = toMongo(val);
    return out;
  }
  return v;
}

/**
 * Build the mirror document (without _id) for a Firestore doc.
 * Root docs keep their Firestore id as _id; subcollection docs use the full path
 * so ids never collide across different parents.
 */
export function mirrorIdFor(snap: DocumentSnapshot): string {
  const isRoot = snap.ref.parent.parent === null;
  return isRoot ? snap.id : snap.ref.path;
}

export function mirrorBodyFor(snap: DocumentSnapshot): Document {
  const data = (toMongo(snap.data() ?? {}) as Record<string, unknown>) ?? {};
  if ("_id" in data) {
    data._id_original = data._id;
    delete data._id;
  }
  if ("_fs" in data) {
    data._fs_original = data._fs;
    delete data._fs;
  }
  return {
    ...data,
    _fs: {
      id: snap.id,
      path: snap.ref.path,
      parent: snap.ref.parent.parent?.path ?? null,
      createTime: snap.createTime?.toDate() ?? null,
      updateTime: snap.updateTime?.toDate() ?? null,
      mirroredAt: new Date(),
    },
  };
}

// ---------- Reports ----------

export function writeReport(name: string, data: unknown): string {
  const dir = path.resolve("migration-reports");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}
