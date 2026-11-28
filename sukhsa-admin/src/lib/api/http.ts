import "server-only";
import { NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import { auth } from "@/auth";
import type { AppRole } from "@/lib/access";
import { ApiError, type Actor } from "./errors";

export { ApiError, notFound, parse, type Actor } from "./errors";

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "Request body must be JSON");
  }
}

export const searchParams = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);

function toErrorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
  }
  if (err instanceof MongoServerError && err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "value";
    return NextResponse.json({ error: `That ${field} is already in use` }, { status: 409 });
  }
  if (err instanceof MongoServerError && err.code === 121) {
    return NextResponse.json({ error: "The database rejected this record as invalid" }, { status: 400 });
  }
  console.error("API error:", err);
  return NextResponse.json({ error: "Something went wrong on the server" }, { status: 500 });
}

/**
 * Wrap a route handler: requires a signed-in user with one of `roles`,
 * turns returned objects into JSON, and turns errors into clean JSON errors.
 */
export function withAuth<P = Record<string, string>>(
  roles: AppRole[],
  handler: (req: Request, ctx: { params: P }, actor: Actor) => Promise<unknown>,
) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const session = await auth();
      const u = session?.user;
      if (!u?.role || !u.id) throw new ApiError(401, "Please sign in");
      if (!roles.includes(u.role)) throw new ApiError(403, "Your role isn't allowed to do this");
      // Guards have no email; the activity log shows their username instead.
      const actor: Actor = { id: u.id, email: u.email ?? `guard:${u.username ?? u.id}`, name: u.name, role: u.role };
      const out = await handler(req, { params: await ctx.params }, actor);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
