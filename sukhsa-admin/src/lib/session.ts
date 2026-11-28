import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homeFor, type AppRole } from "@/lib/access";

/**
 * Use at the top of every protected page / API.
 * Middleware already blocks the wrong people; this is the second lock on the door.
 */
export async function requireRole(allowed: AppRole[]) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || !role) redirect("/");
  if (!allowed.includes(role)) redirect(homeFor(role));
  return session.user;
}
