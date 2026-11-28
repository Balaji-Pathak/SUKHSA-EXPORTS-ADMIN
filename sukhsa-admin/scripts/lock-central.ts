/**
 * Mark sukhsa_central as the live source of truth (cutover from Firestore).
 * After this, `npm run central:build` refuses to overwrite it.
 *
 *   npm run central:lock
 */
import { openMirror, requireEnv } from "./lib/common";

async function main() {
  const { client } = await openMirror();
  const db = client.db(requireEnv("MONGODB_DB"));
  const res = await db.collection<{ _id: string }>("settings").updateOne(
    { _id: "cutover" },
    {
      $setOnInsert: {
        _id: "cutover",
        lockedAt: new Date(),
        note: "sukhsa_central is the live source of truth. Firestore data was copied for the last time; do not rebuild from the mirror.",
      },
    },
    { upsert: true },
  );
  console.log(res.upsertedCount ? `Locked "${db.databaseName}" as the live source of truth.` : `"${db.databaseName}" was already locked.`);
  await client.close();
}

main().catch((err) => {
  console.error("Lock failed:", err);
  process.exit(1);
});
