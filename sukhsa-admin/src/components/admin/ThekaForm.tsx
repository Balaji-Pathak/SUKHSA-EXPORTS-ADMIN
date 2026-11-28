"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { btn, field } from "@/components/ui/ui";
import { FormError } from "@/components/ui/Modal";
import { api } from "@/lib/client/api";

/** Set (or clear with 0) the Theka hours for one employee and month. */
export function ThekaForm({ employeeId, defaultMonth }: { employeeId: string; defaultMonth: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const submit = (fd: FormData) => {
    setError(null);
    setSaved(false);
    start(async () => {
      try {
        await api(`/api/v1/employees/${employeeId}/theka`, { method: "PUT", body: { month: fd.get("month"), hours: Number(fd.get("hours")) } });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <form action={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={field.label}>Month</span>
          <input type="month" name="month" required defaultValue={defaultMonth} className={field.input} />
        </label>
        <label>
          <span className={field.label}>Theka hours</span>
          <input type="number" name="hours" step="0.25" min="0" required placeholder="e.g. 1" className={field.input} />
        </label>
      </div>
      <FormError message={error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? "Saving…" : "Save Theka"}
        </button>
        {saved && <span className="text-sm font-medium text-brand">Saved</span>}
      </div>
      <p className={field.hint}>Theka hours are subtracted from that month&apos;s working hours. Enter 0 to remove.</p>
    </form>
  );
}
