import { withAuth, ApiError, parse, readJson } from "@/lib/api/http";
import { ADMIN_ROLES, STAFF_READ_ROLES } from "@/lib/access";
import { deleteEmployee, deleteEmployeeInput, employeePatch, getEmployee, getThekaForEmployee, updateEmployee } from "@/lib/services/employees";

type P = { id: string };

/** GET /api/v1/employees/:id  -> employee + monthly Theka (supervisors: own team only, no pay data) */
export const GET = withAuth<P>(STAFF_READ_ROLES, async (_req, { params }, actor) => {
  const employee = await getEmployee(params.id);
  if (actor.role === "supervisor") {
    if (employee.supervisorId !== actor.id) throw new ApiError(404, "Employee not found");
    const { hourlyRate: _r, ...rest } = employee;
    return { employee: rest };
  }
  return { employee, theka: await getThekaForEmployee(params.id) };
});

/** PATCH /api/v1/employees/:id  { any employee field; active: false to deactivate } */
export const PATCH = withAuth<P>(ADMIN_ROLES, async (req, { params }, actor) => {
  const patch = parse(employeePatch, await readJson(req));
  return { employee: await updateEmployee(params.id, patch, actor) };
});

/** DELETE /api/v1/employees/:id  { confirmCode: "<their empCode>", reason? }  -> permanently deletes employee + all attendance */
export const DELETE = withAuth<P>(ADMIN_ROLES, async (req, { params }, actor) => {
  const input = parse(deleteEmployeeInput, await readJson(req));
  return deleteEmployee(params.id, input, actor);
});
