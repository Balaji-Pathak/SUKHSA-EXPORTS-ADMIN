import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { signOut } from "@/auth";
import { ROLE_LABEL, type PanelRole } from "@/lib/access";

interface ShellUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: PanelRole;
}

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Top bar shared by every signed-in page: logo, who is signed in, role, sign out. */
export function PanelShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <div className="bg-mesh min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Logo priority />
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-semibold text-ink">{user.name ?? user.email}</div>
              <div className="text-xs text-ink-faint">{ROLE_LABEL[user.role]}</div>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand" aria-hidden="true">
              {initials(user.name, user.email)}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-red-300 hover:text-red-600"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
