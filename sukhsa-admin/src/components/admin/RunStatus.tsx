import { BadgeCheck, Banknote, Clock, FileEdit, Undo2 } from "lucide-react";
import type { PayrollRunStatus } from "@/lib/schema";

const MAP: Record<PayrollRunStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  draft: { label: "Draft", cls: "bg-surface-2 text-ink-soft", Icon: FileEdit },
  submitted: { label: "Waiting for approval", cls: "bg-accent-soft text-accent", Icon: Clock },
  rejected: { label: "Sent back", cls: "bg-red-500/10 text-red-600", Icon: Undo2 },
  approved: { label: "Approved", cls: "bg-brand-soft text-brand", Icon: BadgeCheck },
  paid: { label: "Paid", cls: "bg-sky-500/10 text-sky-600", Icon: Banknote },
};

/** Payroll month status pill. */
export function RunStatus({ status, size = "sm" }: { status: PayrollRunStatus; size?: "sm" | "lg" }) {
  const s = MAP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${s.cls} ${size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs"}`}>
      <s.Icon className={size === "lg" ? "size-4" : "size-3.5"} /> {s.label}
    </span>
  );
}

/** Who did what, e.g. "Submitted by accounts@… on 3 Nov". */
export function stampText(verb: string, stamp?: { by: string; at: Date | string } | null) {
  if (!stamp) return null;
  return `${verb} by ${stamp.by} on ${new Date(stamp.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}`;
}
