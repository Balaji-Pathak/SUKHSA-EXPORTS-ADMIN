/**
 * Check the MongoDB mirror against live Firestore.
 *   1. Document counts per root collection (Firestore count() vs MongoDB countDocuments).
 *   2. Field-by-field comparison of a random sample of documents per collection.
 *
 *   npm run migrate:verify
 *
 * Read-only on both sides. Counts can differ slightly if the live app wrote new
 * attendance records after the last migration run; just re-run `npm run migrate`.
 */
import { Binary, type Document } from "mongodb";
import {
  openFirestore,
  openMirror,
  excludedCollections,
  mirrorBodyFor,
  writeReport,
} from "./lib/common";

const SAMPLE_SIZE = 25;

/** Stable, comparable string form of a value (sorted keys, dates as ISO, binary as base64). */
function canon(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return { $date: v.toISOString() };
  if (v instanceof Binary) return { $bin: Buffer.from(v.buffer).toString("base64") };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { $bin: Buffer.from(v).toString("base64") };
  if (Array.isArray(v)) return v.map(canon);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) out[k] = canon((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

function withoutMeta(doc: Document): Document {
  const { _id, _fs, ...rest } = doc;
  void _id;
  void _fs;
  return rest;
}

async function main() {
  const fs = openFirestore();
  const { client, mirror } = await openMirror();
  const excluded = excludedCollections();

  const rows: Record<string, { firestore: number; mongo: number; diff: number; sampled: number; mismatched: number }> = {};
  const mismatches: { collection: string; id: string }[] = [];

  for (const col of await fs.listCollections()) {
    if (excluded.has(col.id)) continue;
    const fsCount = (await col.count().get()).data().count;
    const mongoCol = mirror.collection(col.id);
    const mongoCount = await mongoCol.countDocuments();

    const sample = await mongoCol.aggregate<Document>([{ $sample: { size: SAMPLE_SIZE } }]).toArray();
    let bad = 0;
    for (const m of sample) {
      const live = await col.doc(String(m._id)).get();
      if (!live.exists) {
        bad++;
        mismatches.push({ collection: col.id, id: String(m._id) });
        continue;
      }
      const expected = JSON.stringify(canon(withoutMeta(mirrorBodyFor(live))));
      const actual = JSON.stringify(canon(withoutMeta(m)));
      if (expected !== actual) {
        bad++;
        mismatches.push({ collection: col.id, id: String(m._id) });
      }
    }
    rows[col.id] = { firestore: fsCount, mongo: mongoCount, diff: mongoCount - fsCount, sampled: sample.length, mismatched: bad };
  }

  console.table(rows);
  const ok = Object.values(rows).every((r) => r.diff === 0 && r.mismatched === 0);
  console.log(
    ok
      ? "\nAll counts match and every sampled document is identical."
      : "\nSome differences found. If the live app wrote data since the last run, run `npm run migrate` again and re-verify.",
  );
  if (mismatches.length) console.log("Mismatched document ids (no field values shown):", mismatches);

  const file = writeReport("verify", { rows, mismatches, ok, finishedAt: new Date().toISOString() });
  console.log(`Report saved to ${file}`);
  await client.close();
  process.exit(ok ? 0 : 2);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
