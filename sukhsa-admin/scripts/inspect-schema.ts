/**
 * Summarise the SHAPE of each mirrored collection: field names, value types, and how
 * often each field appears. Prints field names and types only, never the values,
 * so the output is safe to share while designing the central schema.
 *
 *   npm run migrate:inspect
 */
import { Binary, type Document } from "mongodb";
import { openMirror, writeReport } from "./lib/common";

const SAMPLE = 2000;
const MAX_DEPTH = 3;

function typeOf(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  if (v instanceof Date) return "date";
  if (v instanceof Binary) return "binary";
  if (typeof v === "object" && v && "_ref" in v) return "reference";
  return typeof v;
}

function walk(doc: Record<string, unknown>, prefix: string, depth: number, into: Map<string, Map<string, number>>) {
  for (const [k, v] of Object.entries(doc)) {
    if (!prefix && (k === "_id" || k === "_fs")) continue;
    const key = prefix ? `${prefix}.${k}` : k;
    const t = typeOf(v);
    const types = into.get(key) ?? new Map<string, number>();
    types.set(t, (types.get(t) ?? 0) + 1);
    into.set(key, types);
    if (t === "object" && depth < MAX_DEPTH) walk(v as Record<string, unknown>, key, depth + 1, into);
  }
}

async function main() {
  const { client, mirror } = await openMirror();
  const out: Record<string, { documents: number; sampled: number; fields: Record<string, string> }> = {};

  for (const { name } of await mirror.listCollections({}, { nameOnly: true }).toArray()) {
    const col = mirror.collection(name);
    const documents = await col.estimatedDocumentCount();
    const docs = await col.aggregate<Document>([{ $sample: { size: SAMPLE } }]).toArray();
    const fields = new Map<string, Map<string, number>>();
    for (const d of docs) walk(d, "", 1, fields);

    const summary: Record<string, string> = {};
    for (const [field, types] of [...fields.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const seen = [...types.values()].reduce((a, b) => a + b, 0);
      const pct = docs.length ? Math.round((seen / docs.length) * 100) : 0;
      summary[field] = `${[...types.keys()].join(" | ")}  (${pct}%)`;
    }
    out[name] = { documents, sampled: docs.length, fields: summary };

    console.log(`\n=== ${name}  (${documents} docs, sampled ${docs.length}) ===`);
    for (const [f, s] of Object.entries(summary)) console.log(`  ${f.padEnd(40)} ${s}`);
  }

  const file = writeReport("schema", out);
  console.log(`\nSchema summary saved to ${file}`);
  await client.close();
}

main().catch((err) => {
  console.error("Inspect failed:", err);
  process.exit(1);
});
