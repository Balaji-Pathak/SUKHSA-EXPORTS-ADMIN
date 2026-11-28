import { withAuth, parse, readJson } from "@/lib/api/http";
import { updatePanelUser, userPatch } from "@/lib/services/users";

/** PATCH /api/v1/users/:id  { role?, active?, displayName? }  (Super Admin only) */
export const PATCH = withAuth<{ id: string }>(["super_admin"], async (req, { params }, actor) => {
  const patch = parse(userPatch, await readJson(req));
  return { user: await updatePanelUser(decodeURIComponent(params.id), patch, actor) };
});
