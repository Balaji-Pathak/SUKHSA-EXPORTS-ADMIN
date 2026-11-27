/**
 * Copy every Firestore collection (and subcollection) into the MongoDB mirror database.
 *
 *   npm run migrate:dry   -> read and count only, writes nothing anywhere
 *   npm run migrate       -> upsert into MONGODB_MIRROR_DB
 *
 * Safe to re-run: each document is upserted by its Firestore id, so running it again
 * refreshes the copy with the latest live data and never creates duplicates.
 * Firestore is only read (paged queries). The live attendance app is not touched.
 */
import { FieldPath, type CollectionReference, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { AnyBulkWriteOperation, Db, Document } from "mongodb";
import {
  openFirestore,
  openMirror,
  excludedCollections,
  mongoNameFor,
  mirrorIdFor,
  mirrorBodyFor,
  writeReport,
} from "./lib/common";

const PAGE_SIZE = 300;
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const SKIP_SUBCOLLECTIONS = args.has("--no-subcollections");

/** Mirror docs keep Firestore's string ids instead of ObjectIds. */
type MirrorDoc = Document & { _id: string };

const counts: Record<string, number> = {};

async function copyCollection(col: CollectionReference, mirror: Db | null): Promise<void> {
  const target = mongoNameFor(col.path);
  counts[target] ??= 0;
  let last: QueryDocumentSnapshot | undefined;

  for (;;) {
    let q = col.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    if (mirror) {
      const ops: AnyBulkWriteOperation<MirrorDoc>[] = snap.docs.map((d) => ({
        replaceOne: { filter: { _id: mirrorIdFor(d) }, replacement: mirrorBodyFor(d), upsert: true },
      }));
      await mirror.collection<MirrorDoc>(target).bulkWrite(ops, { ordered: false });
    }
    counts[target] += snap.size;
    process.stdout.write(`\r  ${target}: ${counts[target]} docs`);

    if (!SKIP_SUBCOLLECTIONS) {
      for (const d of snap.docs) {
        const subs = await d.ref.listCollections();
        for (const sub of subs) {
          process.stdout.write("\n");
          await copyCollection(sub, mirror);
        }
      }
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }
  process.stdout.write("\n");
}

async function main() {
  const started = Date.now();
  const fs = openFirestore();
  const excluded = excludedCollections();
  const conn = DRY_RUN ? null : await openMirror();

  console.log(DRY_RUN ? "DRY RUN: reading Firestore only, nothing will be written.\n" : `Writing to MongoDB database "${conn!.mirror.databaseName}".\n`);

  const roots = await fs.listCollections();
  const skipped: string[] = [];
  for (const col of roots) {
    if (excluded.has(col.id)) {
      skipped.push(col.id);
      console.log(`- skipping ${col.id} (in MIGRATE_EXCLUDE)`);
      continue;
    }
    console.log(`- ${col.id}`);
    await copyCollection(col, conn?.mirror ?? null);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const report = {
    mode: DRY_RUN ? "dry-run" : "write",
    mirrorDb: conn?.mirror.databaseName ?? null,
    firestoreDatabase: process.env.FIRESTORE_DATABASE_ID,
    rootCollectionsFound: roots.map((c) => c.id),
    skipped,
    counts,
    totalDocuments: total,
    seconds: Math.round((Date.now() - started) / 1000),
    finishedAt: new Date().toISOString(),
  };
  const file = writeReport(DRY_RUN ? "dry-run" : "migration", report);

  console.log(`\nDone. ${total} documents across ${Object.keys(counts).length} collections in ${report.seconds}s.`);
  console.table(counts);
  console.log(`Report saved to ${file}`);
  await conn?.client.close();
}

main().catch((err) => {
  console.error("\nMigration failed:", err);
  process.exit(1);
});
