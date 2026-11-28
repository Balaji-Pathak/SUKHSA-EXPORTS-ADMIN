import type { ReactNode } from "react";
import { requireRole } from "@/lib/session";
import { ADMIN_ROLES } from "@/lib/access";
import { AppShell } from "@/components/shell/AppShell";

/** Accounts area: Admin (accountant) and Super Admin (CEO). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(ADMIN_ROLES);
  return <AppShell user={user}>{children}</AppShell>;
}
