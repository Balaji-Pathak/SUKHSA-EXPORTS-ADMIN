"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { btn, field } from "@/components/ui/ui";
import { api } from "@/lib/client/api";

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
];

export function AddUser() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (fd: FormData) => {
    setError(null);
    start(async () => {
      try {
        await api("/api/v1/users", { body: { email: fd.get("email"), role: fd.get("role"), displayName: fd.get("displayName") || undefined } });
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
        <UserPlus className="size-4" /> Add user
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Give someone access">
        <form action={save} className="space-y-4">
          <label className="block">
            <span className={field.label}>Google email</span>
            <input type="email" name="email" required placeholder="name@gmail.com" className={field.input} />
            <span className={field.hint}>They sign in with &ldquo;Continue with Google&rdquo; using exactly this email.</span>
          </label>
          <label className="block">
            <span className={field.label}>Name (optional)</span>
            <input name="displayName" className={field.input} />
          </label>
          <label className="block">
            <span className={field.label}>Role</span>
            <select name="role" defaultValue="admin" className={field.input}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <div className="rounded-xl bg-accent-soft px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
            While Google sign-in is in <b>Testing</b> mode, also add this email under Google Cloud → Google Auth Platform → Audience → Test users.
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>Cancel</button>
            <button type="submit" disabled={pending} className={btn.primary}>{pending ? "Saving…" : "Add user"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Inline role change and activate/deactivate for one user row. */
export function UserRowActions({ id, role, active, isSelf }: { id: string; role: string; active: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const patch = (body: Record<string, unknown>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return router.refresh();
    setError(null);
    start(async () => {
      try {
        await api(`/api/v1/users/${encodeURIComponent(id)}`, { method: "PATCH", body });
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
        router.refresh();
      }
    });
  };

  if (isSelf) return <span className="text-xs text-ink-faint">You</span>;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        aria-label="Role"
        defaultValue={role}
        disabled={pending}
        onChange={(e) => patch({ role: e.target.value }, `Change role to ${ROLES.find((r) => r.value === e.target.value)?.label}?`)}
        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold text-ink"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => patch({ active: !active }, active ? "Remove this person's access? They will be signed out within 5 minutes." : undefined)}
        className={active ? "rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10" : "rounded-lg px-2 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft"}
      >
        {active ? "Remove access" : "Restore access"}
      </button>
      {error && <span className="w-full text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}
