import { withAuth, parse, readJson } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { attendancePatch, correctAttendance, deleteAttendance, deleteInput } from "@/lib/services/attendance";

type P = { id: string };

/** PATCH /api/v1/attendance/:id  { inTime?, outTime?, pausedMinutes?, reason }  -> payroll recalculated */
export const PATCH = withAuth<P>(ADMIN_ROLES, async (req, { params }, actor) => {
  const patch = parse(attendancePatch, await readJson(req));
  return { record: await correctAttendance(params.id, patch, actor) };
});

/** DELETE /api/v1/attendance/:id  { reason } */
export const DELETE = withAuth<P>(ADMIN_ROLES, async (req, { params }, actor) => {
  const { reason } = parse(deleteInput, await readJson(req));
  return deleteAttendance(params.id, reason, actor);
});
