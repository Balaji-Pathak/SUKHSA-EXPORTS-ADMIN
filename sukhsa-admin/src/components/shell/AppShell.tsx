import type { ReactNode } from "react";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, type PayrollRun } from "@/lib/schema";
import type { AppRole } from "@/lib/access";
import { AppFrame } from "./AppFrame";

/** Server wrapper: adds live menu badges (e.g. payroll waiting for the CEO) to the shared layout. */
export async function AppShell({ user, children }: { user: { name?: string | null; email?: string | null; role: AppRole }; children: ReactNode }) {
  const badges: Record<string, number> = {};
  if (user.role === "super_admin" || user.role === "admin") {
    const db = await getDb();
    const runs = db.collection<PayrollRun>(COLLECTIONS.payrollRuns);
    if (user.role === "super_admin") badges.approvals = await runs.countDocuments({ status: "submitted" });
    // Admin: months the CEO sent back, or approved and waiting to be paid.
    else badges.payroll = await runs.countDocuments({ status: { $in: ["rejected", "approved"] } });
  }
  return (
    <AppFrame user={{ name: user.name, email: user.email, role: user.role }} badges={badges}>
      {children}
    </AppFrame>
  );
}
