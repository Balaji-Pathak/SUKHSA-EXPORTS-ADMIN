import { withAuth, parse, readJson } from "@/lib/api/http";
import { addPanelUser, listPanelUsers, userInput } from "@/lib/services/users";

/** GET /api/v1/users  (Super Admin only) */
export const GET = withAuth(["super_admin"], async () => ({ users: await listPanelUsers() }));

/** POST /api/v1/users  { email, role, displayName? }  (Super Admin only) */
export const POST = withAuth(["super_admin"], async (req, _ctx, actor) => {
  const input = parse(userInput, await readJson(req));
  return { user: await addPanelUser(input, actor) };
});
