import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/** GET /api/health: confirms the server can reach MongoDB Atlas. */
export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json({ ok: true, db: db.databaseName, time: new Date().toISOString() });
  } catch (err) {
    console.error("Health check failed:", err);
    return NextResponse.json({ ok: false, error: "Database unreachable" }, { status: 503 });
  }
}
