"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Banknote, RotateCcw, Send, Undo2 } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { btn, field } from "@/components/ui/ui";
import { api } from "@/lib/client/api";

type Action = "submit" | "approve" | "reject" | "mark_paid" | "reopen";

const META: Record<Action, { label: string; icon: typeof Send; cls: string; confirm: string; note?: "required" | "optional" }> = {
  submit: { label: "Submit for approval", icon: Send, cls: btn.primary, confirm: "Send this month's payroll to the CEO for approval? Attendance and Theka for the month will be frozen.", note: "optional" },
  approve: { label: "Approve payroll", icon: BadgeCheck, cls: btn.primary, confirm: "Approve this payroll for payment?", note: "optional" },
  reject: { label: "Send back", icon: Undo2, cls: btn.secondary, confirm: "Send this payroll back to Accounts for changes?", note: "required" },
  mark_paid: { label: "Mark as paid", icon: Banknote, cls: btn.primary, confirm: "Confirm the wages for this month have been paid?", note: "optional" },
  reopen: { label: "Reopen month", icon: RotateCcw, cls: btn.secondary, confirm: "Reopen this month? It goes back to Draft and becomes editable.", note: "required" },
};

/** The buttons for the next step of a month's payroll. The server decides which actions this person may take. */
export function PayrollWorkflow({ month, label, actions, total }: { month: string; label: string; actions: Action[]; total: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!actions.length) return null;
  const m = current ? META[current] : null;

  const run = (fd: FormData) => {
    if (!current) return;
    setError(null);
    start(async () => {
      try {
        await api(`/api/v1/payroll/${month}/status`, { body: { action: current, note: String(fd.get("note") ?? "").trim() || undefined } });
        setCurrent(null);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <>
      {actions.map((a) => {
        const Icon = META[a].icon;
        return (
          <button key={a} type="button" onClick={() => { setError(null); setCurrent(a); }} className={META[a].cls}>
            <Icon className="size-4" /> {META[a].label}
          </button>
        );
      })}
      <Modal open={!!current} onClose={() => setCurrent(null)} title={m ? `${m.label} · ${label}` : ""}>
        {m && (
          <form action={run} className="space-y-4">
            <p className="text-sm text-ink-soft">{m.confirm}</p>
            <div className="rounded-xl bg-surface-2 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Total net payable</div>
              <div className="text-2xl font-extrabold tabular-nums text-ink">{total}</div>
            </div>
            {m.note && (
              <label>
                <span className={field.label}>{m.note === "required" ? "Reason (required)" : "Note (optional)"}</span>
                <textarea name="note" rows={3} required={m.note === "required"} minLength={m.note === "required" ? 3 : undefined} className={field.input} />
              </label>
            )}
            <FormError message={error} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCurrent(null)} className={btn.secondary}>Cancel</button>
              <button type="submit" disabled={pending} className={btn.primary}>{pending ? "Saving…" : m.label}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
