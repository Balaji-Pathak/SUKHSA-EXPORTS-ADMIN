import { z } from "zod";
import { withAuth, parse, readJson } from "@/lib/api/http";
import { GATE_ROLES } from "@/lib/access";
import { gateAction } from "@/lib/services/gate";

const body = z.object({ action: z.enum(["in", "pause", "resume", "out"]) });

/** POST /api/v1/gate/:employeeId  { action: "in" | "pause" | "resume" | "out" } */
export const POST = withAuth<{ employeeId: string }>(GATE_ROLES, async (req, { params }, actor) => {
  const { action } = parse(body, await readJson(req));
  return gateAction(params.employeeId, action, actor);
});
