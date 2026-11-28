import type { z } from "zod";
import type { AppRole } from "@/lib/access";

/**
 * Plain types and errors shared by services and API routes.
 * No Next.js / auth imports here, so business logic stays testable on its own.
 */

/** Who is making a change. Every write records this in the audit log. */
export interface Actor {
  id: string;
  email: string;
  name?: string | null;
  role: AppRole;
}

/** Throw this from services/routes to send a clean JSON error. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, `${what} not found`);

/** Validate input with a zod schema; a bad request becomes a 400 listing each problem. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = r.error.issues.map((i) => ({ field: i.path.join(".") || "(body)", message: i.message }));
    throw new ApiError(400, fields.map((f) => `${f.field}: ${f.message}`).join("; "), fields);
  }
  return r.data;
}
