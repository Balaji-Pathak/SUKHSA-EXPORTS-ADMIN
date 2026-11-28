import { withAuth, parse, readJson, searchParams } from "@/lib/api/http";
import { ADMIN_ROLES, STAFF_READ_ROLES } from "@/lib/access";
import { createEmployee, employeeInput, listEmployees } from "@/lib/services/employees";

/** GET /api/v1/employees?q=&category=permanent|temporary&department=&active=true|false  (supervisors: own team only) */
export const GET = withAuth(STAFF_READ_ROLES, async (req, _ctx, actor) => {
  const p = searchParams(req);
  const employees = await listEmployees({
    q: p.q,
    category: p.category === "permanent" || p.category === "temporary" ? p.category : undefined,
    department: p.department || undefined,
    active: p.active === "true" ? true : p.active === "false" ? false : undefined,
    supervisorId: actor.role === "supervisor" ? actor.id : p.supervisorId || undefined,
  });
  // Supervisors don't see pay rates.
  return { employees: actor.role === "supervisor" ? employees.map(({ hourlyRate: _r, ...e }) => e) : employees };
});

/** POST /api/v1/employees  { empCode, name, department, category, hourlyRate, breakMinutes?, active? } */
export const POST = withAuth(ADMIN_ROLES, async (req, _ctx, actor) => {
  const input = parse(employeeInput, await readJson(req));
  return { employee: await createEmployee(input, actor) };
});
