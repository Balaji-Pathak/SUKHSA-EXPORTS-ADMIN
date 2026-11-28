/** Create/update collections, validators and indexes in the central DB. Safe to re-run.  npm run central:schema */
import { openMirror, requireEnv } from "./lib/common";
import { ensureSchema } from "../src/lib/schema";

async function main() {
  const { client } = await openMirror();
  const db = client.db(requireEnv("MONGODB_DB"));
  await ensureSchema(db);
  console.log(`Schema, validators and indexes are up to date in "${db.databaseName}".`);
  await client.close();
}
main().catch((err) => {
  console.error("Schema update failed:", err);
  process.exit(1);
});
