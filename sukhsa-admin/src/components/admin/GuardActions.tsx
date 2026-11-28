"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { btn, field } from "@/components/ui/ui";
import { api } from "@/lib/client/api";

export function AddGuard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (fd: FormData) => {
    setError(null);
    start(async () => {
      try {
        await api("/api/v1/guards", { body: { username: fd.get("username"), displayName: fd.get("displayName") || undefined, password: fd.get("password") } });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn.primary}>
        <UserPlus className="size-4" /> Add guard
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New guard login">
        <form action={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={field.label}>Username</span>
              <input name="username" required pattern="[A-Za-z0-9_\-]{3,40}" autoCapitalize="none" placeholder="gate1" className={field.input} />
              <span className={field.hint}>3–40 letters, numbers, - or _</span>
            </label>
            <label>
              <span className={field.label}>Display name</span>
              <input name="displayName" placeholder="Main Gate" className={field.input} />
            </label>
          </div>
          <label>
            <span className={field.label}>Password</span>
            <input name="password" type="text" required minLength={6} autoComplete="new-password" className={field.input} />
            <span className={field.hint}>At least 6 characters. Share it with the guard privately.</span>
          </label>
          <FormError message={error} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>Cancel</button>
            <button type="submit" disabled={pending} className={btn.primary}>{pending ? "Saving…" : "Create guard"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function GuardRowActions({ id, username, active }: { id: string; username: string; active: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const url = `/api/v1/guards/${encodeURIComponent(id)}`;

  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <button type="button" onClick={() => setOpen(true)} className={btn.ghost}>
        <KeyRound className="size-3.5" /> Reset password
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => api(url, { method: "PATCH", body: { active: !active } }))}
        className={active ? "rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft" : "rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft"}
      >
        {active ? "Deactivate" : "Activate"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => confirm(`Delete guard "${username}" permanently?`) && run(() => api(url, { method: "DELETE" }))}
        className="rounded-lg p-1.5 text-red-600 hover:bg-red-500/10"
        aria-label={`Delete ${username}`}
      >
        <Trash2 className="size-3.5" />
      </button>
      {error && <span className="w-full text-right text-xs text-red-600">{error}</span>}
      <Modal open={open} onClose={() => setOpen(false)} title={`Reset password · ${username}`}>
        <form action={(fd) => run(() => api(url, { method: "PATCH", body: { password: fd.get("password") } }), () => setOpen(false))} className="space-y-4">
          <label>
            <span className={field.label}>New password</span>
            <input name="password" type="text" required minLength={6} autoComplete="new-password" className={field.input} />
            <span className={field.hint}>The guard&apos;s old password stops working immediately.</span>
          </label>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>Cancel</button>
            <button type="submit" disabled={pending} className={btn.primary}>{pending ? "Saving…" : "Set password"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
