import { withAuth, parse, readJson, searchParams } from "@/lib/api/http";
import { ADMIN_ROLES, STAFF_READ_ROLES } from "@/lib/access";
import { attendanceInput, attendanceQuery, createAttendance, listAttendance } from "@/lib/services/attendance";
import { teamEmployeeIds } from "@/lib/services/teams";

/** GET /api/v1/attendance?month=YYYY-MM | date=YYYY-MM-DD | employeeId= | status=  (supervisors: own team only) */
export const GET = withAuth(STAFF_READ_ROLES, async (req, _ctx, actor) => {
  const q = parse(attendanceQuery, searchParams(req));
  const team = actor.role === "supervisor" ? await teamEmployeeIds(actor.id) : undefined;
  return { attendance: await listAttendance(q, team) };
});

/** POST /api/v1/attendance  { employeeId, date, inTime, outTime?, pausedMinutes?, reason? }  (manual entry) */
export const POST = withAuth(ADMIN_ROLES, async (req, _ctx, actor) => {
  const input = parse(attendanceInput, await readJson(req));
  return { record: await createAttendance(input, actor) };
});
