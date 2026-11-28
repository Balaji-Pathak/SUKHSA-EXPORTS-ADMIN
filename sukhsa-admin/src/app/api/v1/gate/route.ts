import { withAuth } from "@/lib/api/http";
import { GATE_ROLES } from "@/lib/access";
import { gateBoard } from "@/lib/services/gate";
import { teamEmployeeIds } from "@/lib/services/teams";

/** GET /api/v1/gate  -> active employees with today's In / Pause / Out state (supervisors: own team only) */
export const GET = withAuth(GATE_ROLES, async (_req, _ctx, actor) =>
  gateBoard(actor.role === "supervisor" ? await teamEmployeeIds(actor.id) : undefined),
);
