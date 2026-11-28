import { withAuth, parse, readJson } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { setTeam, teamEmployeeIds, teamInput } from "@/lib/services/teams";

type P = { supervisorId: string };

/** GET /api/v1/teams/:supervisorId  -> employee ids in that team */
export const GET = withAuth<P>(ADMIN_ROLES, async (_req, { params }) => ({ employeeIds: await teamEmployeeIds(decodeURIComponent(params.supervisorId)) }));

/** PUT /api/v1/teams/:supervisorId  { employeeIds: [...] }  -> replaces the team */
export const PUT = withAuth<P>(ADMIN_ROLES, async (req, { params }, actor) => {
  const { employeeIds } = parse(teamInput, await readJson(req));
  return setTeam(decodeURIComponent(params.supervisorId), employeeIds, actor);
});
