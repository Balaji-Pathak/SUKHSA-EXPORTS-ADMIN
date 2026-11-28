import type { ReactNode } from "react";
import { requireRole } from "@/lib/session";
import { CEO_ROLES } from "@/lib/access";
import { AppShell } from "@/components/shell/AppShell";

/** CEO area: Super Admin only. */
export default async function CeoLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(CEO_ROLES);
  return <AppShell user={user}>{children}</AppShell>;
}
