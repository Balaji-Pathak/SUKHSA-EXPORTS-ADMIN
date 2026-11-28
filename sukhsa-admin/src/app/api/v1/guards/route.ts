import { withAuth, parse, readJson } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { createGuard, guardInput, listGuards } from "@/lib/services/guards";

/** GET /api/v1/guards  (Admin) */
export const GET = withAuth(ADMIN_ROLES, async () => ({ guards: await listGuards() }));

/** POST /api/v1/guards  { username, password, displayName? }  (Admin) */
export const POST = withAuth(ADMIN_ROLES, async (req, _ctx, actor) => {
  const input = parse(guardInput, await readJson(req));
  return { guard: await createGuard(input, actor) };
});
