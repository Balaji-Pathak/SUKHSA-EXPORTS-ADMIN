import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonth } from "@/lib/dates";

/** Small shared UI pieces (server-safe). */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-ink-soft">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface shadow-soft ${className}`}>{children}</div>;
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {action}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "brand" | "accent" | "red" | "ink";
}) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    accent: "bg-accent-soft text-accent",
    red: "bg-red-500/10 text-red-600",
    ink: "bg-surface-2 text-ink",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{label}</div>
          <div className="mt-2 truncate text-2xl font-extrabold tracking-tight text-ink tabular-nums">{value}</div>
          {hint && <div className="mt-1 text-xs text-ink-soft">{hint}</div>}
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  );
}

const BADGE = {
  green: "bg-brand-soft text-brand",
  amber: "bg-accent-soft text-accent",
  red: "bg-red-500/10 text-red-600",
  gray: "bg-surface-2 text-ink-soft",
  blue: "bg-sky-500/10 text-sky-600",
} as const;

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof BADGE }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${BADGE[tone]}`}>{children}</span>;
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-faint">
        <Icon className="size-6" />
      </span>
      <div className="font-semibold text-ink">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

/** ‹ October 2026 ›  — keeps other query params. */
export function MonthPicker({ month, basePath, params = {} }: { month: string; basePath: string; params?: Record<string, string | undefined> }) {
  const href = (m: string) => {
    const q = new URLSearchParams(Object.entries({ ...params, month: m }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${q}`;
  };
  const btn = "grid size-9 place-items-center rounded-xl text-ink-soft transition hover:bg-surface-2 hover:text-ink";
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-line bg-surface p-1 shadow-sm">
      <Link href={href(shiftMonth(month, -1))} className={btn} aria-label="Previous month">
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-36 px-2 text-center text-sm font-semibold text-ink">{monthLabel(month)}</span>
      <Link href={href(shiftMonth(month, 1))} className={btn} aria-label="Next month">
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

/** Table styling shared by every list page. */
export const table = {
  wrap: "overflow-x-auto",
  table: "w-full min-w-[640px] text-left text-sm",
  th: "whitespace-nowrap border-b border-line bg-surface-2/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-faint",
  td: "whitespace-nowrap border-b border-line px-4 py-3 text-ink-soft",
  tdStrong: "whitespace-nowrap border-b border-line px-4 py-3 font-semibold text-ink",
  num: "whitespace-nowrap border-b border-line px-4 py-3 text-right tabular-nums text-ink",
  thNum: "whitespace-nowrap border-b border-line bg-surface-2/60 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-ink-faint",
  row: "transition hover:bg-surface-2/50",
};

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50",
  ghost: "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink-soft transition hover:bg-surface-2 hover:text-ink",
};

export const field = {
  label: "mb-1.5 block text-sm font-medium text-ink",
  input:
    "w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60",
  hint: "mt-1 block text-xs text-ink-faint",
};
