import { withAuth, parse, readJson } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { deleteGuard, guardPatch, updateGuard } from "@/lib/services/guards";

type P = { id: string };

/** PATCH /api/v1/guards/:id  { displayName?, active?, password? }  (Admin) */
export const PATCH = withAuth<P>(ADMIN_ROLES, async (req, { params }, actor) => {
  const patch = parse(guardPatch, await readJson(req));
  return { guard: await updateGuard(decodeURIComponent(params.id), patch, actor) };
});

/** DELETE /api/v1/guards/:id  (Admin) */
export const DELETE = withAuth<P>(ADMIN_ROLES, async (_req, { params }, actor) => deleteGuard(decodeURIComponent(params.id), actor));
