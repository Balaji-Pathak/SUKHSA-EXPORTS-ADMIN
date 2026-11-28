import { withAuth, parse, readJson } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { setTheka, thekaInput } from "@/lib/services/employees";

/** PUT /api/v1/employees/:id/theka  { month: "YYYY-MM", hours }  (0 hours removes it) */
export const PUT = withAuth<{ id: string }>(ADMIN_ROLES, async (req, { params }, actor) => {
  const { month, hours } = parse(thekaInput, await readJson(req));
  return { theka: await setTheka(params.id, month, hours, actor) };
});
