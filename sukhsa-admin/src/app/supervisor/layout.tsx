import type { ReactNode } from "react";
import { requireRole } from "@/lib/session";
import { SUPERVISOR_ROLES } from "@/lib/access";
import { AppShell } from "@/components/shell/AppShell";

/** Supervisor area: only the supervisor's own team. */
export default async function SupervisorLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(SUPERVISOR_ROLES);
  return <AppShell user={user}>{children}</AppShell>;
}
