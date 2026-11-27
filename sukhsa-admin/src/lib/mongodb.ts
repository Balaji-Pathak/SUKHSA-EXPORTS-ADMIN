import "server-only";
import { MongoClient, type Db } from "mongodb";

/**
 * One shared MongoClient for the whole Next.js server, created on first use.
 * Cached on globalThis so dev hot-reloads don't open a new connection pool on every edit.
 */
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

export function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mongoClient) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
    }
    globalForMongo._mongoClient = new MongoClient(uri, { appName: "sukhsa-admin", maxPoolSize: 10 })
      .connect()
      .catch((err) => {
        globalForMongo._mongoClient = undefined; // allow a retry on the next request
        throw err;
      });
  }
  return globalForMongo._mongoClient;
}

/** The central company database used by all admin / ERP APIs. */
export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB ?? "sukhsa_central");
}
