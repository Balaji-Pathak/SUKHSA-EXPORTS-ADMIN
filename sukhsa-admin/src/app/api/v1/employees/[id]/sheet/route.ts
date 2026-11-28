import { withAuth, searchParams } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { isValidMonth } from "@/lib/dates";
import { employeeSheet, employeeSheetCsv } from "@/lib/services/employee-sheet";

/** GET /api/v1/employees/:id/sheet?month=YYYY-MM&format=csv  -> monthly summaries + day sheet (Individual Sheet) */
export const GET = withAuth<{ id: string }>(ADMIN_ROLES, async (req, { params }) => {
  const p = searchParams(req);
  const sheet = await employeeSheet(params.id, isValidMonth(p.month) ? p.month : undefined);
  if (p.format === "csv") {
    return new Response(employeeSheetCsv(sheet), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sheet.employee.empCode}-${sheet.month ?? "sheet"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return sheet;
});
