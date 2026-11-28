"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { btn, field } from "@/components/ui/ui";
import { api } from "@/lib/client/api";

export interface EmployeeFormValues {
  _id?: string;
  empCode: string;
  name: string;
  department: string;
  category: "permanent" | "temporary";
  hourlyRate: number | string;
  breakMinutes: number | string;
}

/** Add a new employee, or edit an existing one (pass `employee`). */
export function EmployeeDialog({
  employee,
  departments,
  suggestedCode,
}: {
  employee?: EmployeeFormValues;
  departments: string[];
  suggestedCode?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!employee?._id;

  const submit = (fd: FormData) => {
    setError(null);
    const body = {
      empCode: String(fd.get("empCode")),
      name: String(fd.get("name")),
      department: String(fd.get("department")),
      category: String(fd.get("category")),
      hourlyRate: Number(fd.get("hourlyRate")),
      breakMinutes: Number(fd.get("breakMinutes")),
    };
    start(async () => {
      try {
        if (editing) {
          await api(`/api/v1/employees/${employee!._id}`, { method: "PATCH", body });
        } else {
          const { employee: created } = await api<{ employee: { _id: string } }>("/api/v1/employees", { body });
          router.push(`/admin/employees/${created._id}`);
        }
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={editing ? btn.secondary : btn.primary}>
        {editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        {editing ? "Edit" : "Add employee"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${employee!.name}` : "Add employee"}>
        <form action={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={field.label}>Employee code</span>
              <input name="empCode" required defaultValue={employee?.empCode ?? suggestedCode} className={field.input} />
            </label>
            <label>
              <span className={field.label}>Category</span>
              <select name="category" defaultValue={employee?.category ?? "permanent"} className={field.input}>
                <option value="permanent">Permanent</option>
                <option value="temporary">Temporary</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className={field.label}>Full name</span>
            <input name="name" required defaultValue={employee?.name} className={field.input} />
          </label>
          <label className="block">
            <span className={field.label}>Department</span>
            <input name="department" list="departments" defaultValue={employee?.department} className={field.input} placeholder="Worker, Production…" />
            <datalist id="departments">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={field.label}>Hourly rate (₹)</span>
              <input name="hourlyRate" type="number" step="0.01" min="0" required defaultValue={employee?.hourlyRate} className={field.input} />
              <span className={field.hint}>Rounded to 2 decimals (e.g. 84.384 → 84.38)</span>
            </label>
            <label>
              <span className={field.label}>Break (minutes)</span>
              <input name="breakMinutes" type="number" min="0" max="240" required defaultValue={employee?.breakMinutes ?? 30} className={field.input} />
              <span className={field.hint}>Deducted when a shift is 4.5 h or longer</span>
            </label>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={btn.primary}>
              {pending ? "Saving…" : editing ? "Save changes" : "Add employee"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Deactivate / reactivate with confirmation. */
export function ToggleActiveButton({ id, active, name }: { id: string; active: boolean; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toggle = () => {
    if (active && !confirm(`Deactivate ${name}? They will be hidden from new payroll months but their history stays.`)) return;
    start(async () => {
      try {
        await api(`/api/v1/employees/${id}`, { method: "PATCH", body: { active: !active } });
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };
  return (
    <>
      <button type="button" onClick={toggle} disabled={pending} className={active ? btn.danger : btn.secondary}>
        {pending ? "Saving…" : active ? "Deactivate" : "Reactivate"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </>
  );
}

/** Permanent delete (employee + all attendance + Theka). Requires typing the employee code. */
export function DeleteEmployeeButton({ id, empCode, name, records }: { id: string; empCode: string; name: string; records: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fd: FormData) => {
    setError(null);
    start(async () => {
      try {
        await api(`/api/v1/employees/${id}`, { method: "DELETE", body: { confirmCode: typed, reason: fd.get("reason") || undefined } });
        setOpen(false);
        router.push("/admin/employees");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn.danger}>
        Delete
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Delete ${name} permanently?`}>
        <form action={run} className="space-y-4">
          <div className="rounded-xl bg-red-500/10 px-3 py-3 text-sm leading-relaxed text-red-700 dark:text-red-400">
            This deletes <b>{name}</b> and <b>all {records} attendance record(s)</b> and Theka entries. It cannot be undone.
            To keep their history, use <b>Deactivate</b> instead.
          </div>
          <label>
            <span className={field.label}>Type <b className="font-mono">{empCode}</b> to confirm</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className={field.input} />
          </label>
          <label>
            <span className={field.label}>Reason (optional)</span>
            <input name="reason" className={field.input} placeholder="e.g. Added by mistake" />
          </label>
          <FormError message={error} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>Cancel</button>
            <button type="submit" disabled={pending || typed.trim().toUpperCase() !== empCode.toUpperCase()} className={btn.danger}>
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
