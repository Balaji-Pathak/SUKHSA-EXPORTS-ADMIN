import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { requireRole } from "@/lib/session";
import { GATE_ROLES } from "@/lib/access";
import { signOutAction } from "@/app/actions";
import { Logo } from "@/components/Logo";
import { AppShell } from "@/components/shell/AppShell";

/**
 * Gate Desk layout. Guards get a focused screen with no menu (they can only use the Gate Desk).
 * Admins, the CEO and supervisors keep their normal sidebar, so they never lose their navigation.
 */
export default async function GateLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(GATE_ROLES);
  if (user.role !== "guard") return <AppShell user={user}>{children}</AppShell>;

  return (
    <div className="bg-mesh min-h-dvh">
      <header className="sticky top-0 z-30 h-16 border-b border-line bg-bg/85 backdrop-blur-lg">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo priority />
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-ink">{user.name ?? user.username}</div>
              <div className="text-xs text-ink-faint">Guard</div>
            </div>
            <form action={signOutAction}>
              <button type="submit" className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-red-300 hover:text-red-600">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
