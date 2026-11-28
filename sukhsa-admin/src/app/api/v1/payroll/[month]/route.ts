import { withAuth, ApiError, searchParams } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { isValidMonth } from "@/lib/dates";
import { monthlyPayroll, payrollCsv } from "@/lib/services/payroll";

/** GET /api/v1/payroll/:month?category=permanent|temporary&format=csv */
export const GET = withAuth<{ month: string }>(ADMIN_ROLES, async (req, { params }) => {
  if (!isValidMonth(params.month)) throw new ApiError(400, "Month must be YYYY-MM");
  const p = searchParams(req);
  const category = p.category === "permanent" || p.category === "temporary" ? p.category : undefined;
  const payroll = await monthlyPayroll(params.month, category);
  if (p.format === "csv") {
    return new Response(payrollCsv(payroll), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sukhsa-payroll-${params.month}${category ? `-${category}` : ""}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return payroll;
});
