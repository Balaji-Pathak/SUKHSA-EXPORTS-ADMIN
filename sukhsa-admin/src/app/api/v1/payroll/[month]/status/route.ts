import { withAuth, ApiError, parse, readJson } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { isValidMonth } from "@/lib/dates";
import { runAction, transitionRun } from "@/lib/services/payroll-runs";

/**
 * POST /api/v1/payroll/:month/status  { action, note? }
 *   submit     Admin / Super Admin   draft|sent back -> waiting for approval (month frozen)
 *   approve    Super Admin           waiting -> approved
 *   reject     Super Admin           waiting -> sent back (note required)
 *   mark_paid  Admin / Super Admin   approved -> paid
 *   reopen     Super Admin           waiting|approved|paid -> draft (note required)
 */
export const POST = withAuth<{ month: string }>(ADMIN_ROLES, async (req, { params }, actor) => {
  if (!isValidMonth(params.month)) throw new ApiError(400, "Month must be YYYY-MM");
  const { action, note } = parse(runAction, await readJson(req));
  return { run: await transitionRun(params.month, action, note, actor) };
});
