/** Quick check that MONGODB_URI in .env.local can reach Atlas.  npm run mongo:ping */
import { openMirror } from "./lib/common";

async function main() {
  const { client, mirror } = await openMirror();
  await client.db("admin").command({ ping: 1 });
  const dbs = await client.db().admin().listDatabases({ nameOnly: true });
  console.log("Connected to MongoDB Atlas OK.");
  console.log("Mirror database will be:", mirror.databaseName);
  console.log("Existing databases:", dbs.databases.map((d) => d.name).join(", ") || "(none)");
  await client.close();
}

main().catch((err) => {
  console.error("Could not connect:", err.message);
  process.exit(1);
});
