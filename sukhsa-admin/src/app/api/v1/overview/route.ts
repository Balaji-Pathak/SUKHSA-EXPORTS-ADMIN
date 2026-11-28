import { withAuth, searchParams } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { currentMonthIST, isValidMonth } from "@/lib/dates";
import { getOverview } from "@/lib/services/overview";

/** GET /api/v1/overview?month=YYYY-MM */
export const GET = withAuth(ADMIN_ROLES, async (req) => {
  const m = searchParams(req).month;
  return getOverview(isValidMonth(m) ? m : currentMonthIST());
});
