"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  ClipboardList,
  DoorOpen,
  History,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  ShieldCheck,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { signOutAction } from "@/app/actions";
import type { AppRole } from "@/lib/access";

type Item = { href: string; label: string; short?: string; icon: LucideIcon; exact?: boolean; badge?: string };
type Section = { title?: string; items: Item[] };

/** Each role gets its own menu. */
function navFor(role: AppRole): Section[] {
  const ops: Item[] = [
    { href: "/gate", label: "Gate Desk", short: "Gate", icon: DoorOpen },
    { href: "/admin/employees", label: "Employees", icon: Users },
    { href: "/admin/attendance", label: "Attendance", short: "Attend.", icon: CalendarCheck },
    { href: "/admin/payroll", label: "Payroll", icon: IndianRupee, badge: "payroll" },
    { href: "/admin/teams", label: "Teams", icon: Network },
    { href: "/admin/guards", label: "Guards", icon: ShieldCheck },
  ];
  if (role === "super_admin")
    return [
      {
        items: [
          { href: "/ceo", label: "CEO Overview", short: "Overview", icon: LayoutDashboard, exact: true },
          { href: "/ceo/approvals", label: "Approvals", icon: BadgeCheck, badge: "approvals" },
        ],
      },
      { title: "Operations", items: ops },
      {
        title: "System",
        items: [
          { href: "/ceo/users", label: "Users & roles", short: "Users", icon: UserCog },
          { href: "/admin/activity", label: "Activity log", short: "Activity", icon: History },
        ],
      },
    ];
  if (role === "admin")
    return [
      { items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true }] },
      { title: "Operations", items: ops },
      { title: "System", items: [{ href: "/admin/activity", label: "Activity log", short: "Activity", icon: History }] },
    ];
  return [
    {
      items: [
        { href: "/supervisor", label: "My team", short: "Team", icon: LayoutDashboard, exact: true },
        { href: "/supervisor/attendance", label: "Team attendance", short: "Attend.", icon: ClipboardList },
        { href: "/gate", label: "Gate Desk", short: "Gate", icon: DoorOpen },
      ],
    },
  ];
}

const ROLE_NAME: Record<AppRole, string> = { super_admin: "Super Admin · CEO", admin: "Admin · Accounts", supervisor: "Supervisor", guard: "Guard" };

export interface FrameUser {
  name?: string | null;
  email?: string | null;
  role: AppRole;
}

/**
 * The signed-in layout for every role and page:
 *   phone   (<768px)   top bar + ☰ slide-out menu
 *   tablet  (768–1279) slim icon rail with short labels, no scrollbars
 *   desktop (≥1280)    full sidebar
 */
export function AppFrame({ user, badges = {}, children }: { user: FrameUser; badges?: Record<string, number>; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const sections = navFor(user.role);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (i: Item) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"));
  const initials = (user.name || user.email || "?")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

  const count = (n?: number, className = "") =>
    n ? <span className={`grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white ${className}`}>{n}</span> : null;

  /** Full-width rows (desktop sidebar and phone drawer). */
  const fullNav = () => (
    <nav aria-label="Main" className="space-y-5">
      {sections.map((s, si) => (
        <div key={si}>
          {s.title && <div className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{s.title}</div>}
          <ul className="space-y-0.5">
            {s.items.map((i) => {
              const on = isActive(i);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={on ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      on ? "bg-brand text-white shadow-sm" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <i.icon className="size-[18px] shrink-0" />
                    <span className="flex-1">{i.label}</span>
                    {count(i.badge ? badges[i.badge] : 0, on ? "bg-white text-brand" : "")}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="bg-mesh min-h-dvh">
      {/* Top bar */}
      <header className="sticky top-0 z-30 h-16 border-b border-line bg-bg/85 backdrop-blur-lg">
        <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-surface-2 hover:text-ink md:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <Logo priority />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden text-right leading-tight sm:block">
              <div className="max-w-48 truncate text-sm font-semibold text-ink">{user.name ?? user.email}</div>
              <div className="text-xs text-ink-faint">{ROLE_NAME[user.role]}</div>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand" aria-hidden="true">
              {initials}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-red-300 hover:text-red-600"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
                <span className="hidden lg:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Tablet rail + desktop sidebar */}
        <aside className="no-scrollbar sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 overflow-y-auto border-r border-line bg-bg/60 md:block md:w-[88px] xl:w-60">
          {/* desktop */}
          <div className="hidden p-4 xl:block">
            {fullNav()}
          </div>
          {/* tablet rail */}
          <nav aria-label="Main" className="flex flex-col items-stretch gap-1 px-2 py-3 xl:hidden">
            {sections.map((s, si) => (
              <div key={si} className={si > 0 ? "mt-1 border-t border-line pt-2" : ""}>
                {s.items.map((i) => {
                  const on = isActive(i);
                  const n = i.badge ? badges[i.badge] : 0;
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      title={i.label}
                      aria-current={on ? "page" : undefined}
                      className={`relative mb-1 flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center transition ${
                        on ? "bg-brand text-white shadow-sm" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      <i.icon className="size-5" />
                      <span className="text-[11px] font-semibold leading-tight">{i.short ?? i.label}</span>
                      {count(n, "absolute right-1.5 top-1")}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      {/* Phone drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="no-scrollbar animate-slide-in absolute inset-y-0 left-0 w-[82%] max-w-xs overflow-y-auto border-r border-line bg-bg p-4 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <div className="leading-tight">
                <div className="text-sm font-bold text-ink">{user.name ?? user.email}</div>
                <div className="text-xs text-ink-faint">{ROLE_NAME[user.role]}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-2" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {fullNav()}
          </div>
        </div>
      )}
    </div>
  );
}
