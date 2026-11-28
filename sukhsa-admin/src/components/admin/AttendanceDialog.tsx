"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { btn, field } from "@/components/ui/ui";
import { api } from "@/lib/client/api";

export interface AttendanceRow {
  _id: string;
  employeeId: string;
  name: string;
  empCode: string;
  date: string;
  inTime: string;
  outTime: string | null;
  pausedSeconds: number;
}

/** Correct an existing record (reason required) or delete it. */
export function EditAttendance({ rec, disabled }: { rec: AttendanceRow; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (fd: FormData) => {
    setError(null);
    start(async () => {
      try {
        await api(`/api/v1/attendance/${encodeURIComponent(rec._id)}`, {
          method: "PATCH",
          body: { inTime: fd.get("inTime"), outTime: fd.get("outTime") || null, pausedMinutes: Number(fd.get("pausedMinutes")), reason: fd.get("reason") },
        });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const remove = () => {
    const reason = prompt(`Delete ${rec.name}'s record on ${rec.date}? Type a reason:`);
    if (!reason) return;
    start(async () => {
      try {
        await api(`/api/v1/attendance/${encodeURIComponent(rec._id)}`, { method: "DELETE", body: { reason } });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={btn.ghost} title={disabled ? "Month is locked" : "Correct this record"}>
        <Pencil className="size-3.5" /> Edit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${rec.name} · ${rec.date}`}>
        <form action={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label>
              <span className={field.label}>In</span>
              <input type="time" name="inTime" required defaultValue={rec.inTime.padStart(5, "0")} className={field.input} />
            </label>
            <label>
              <span className={field.label}>Out</span>
              <input type="time" name="outTime" defaultValue={rec.outTime?.padStart(5, "0") ?? ""} className={field.input} />
            </label>
            <label>
              <span className={field.label}>Paused (min)</span>
              <input type="number" name="pausedMinutes" min="0" defaultValue={Math.floor(rec.pausedSeconds / 60)} className={field.input} />
            </label>
          </div>
          <label className="block">
            <span className={field.label}>Reason for correction</span>
            <input name="reason" required minLength={3} placeholder="e.g. Guard forgot to mark Out" className={field.input} />
            <span className={field.hint}>Saved in the activity log with your name.</span>
          </label>
          <FormError message={error} />
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <button type="button" onClick={remove} disabled={pending} className={btn.danger}>
              <Trash2 className="size-4" /> Delete
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>Cancel</button>
              <button type="submit" disabled={pending} className={btn.primary}>{pending ? "Saving…" : "Save correction"}</button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Manually add a missing day. */
export function AddAttendance({ employees, defaultDate, disabled }: { employees: { _id: string; name: string; empCode: string }[]; defaultDate: string; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (fd: FormData) => {
    setError(null);
    start(async () => {
      try {
        await api("/api/v1/attendance", {
          body: {
            employeeId: fd.get("employeeId"),
            date: fd.get("date"),
            inTime: fd.get("inTime"),
            outTime: fd.get("outTime") || null,
            pausedMinutes: Number(fd.get("pausedMinutes") || 0),
            reason: fd.get("reason") || undefined,
          },
        });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={btn.primary}>
        <Plus className="size-4" /> Add record
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add attendance record">
        <form action={save} className="space-y-4">
          <label className="block">
            <span className={field.label}>Employee</span>
            <select name="employeeId" required className={field.input} defaultValue="">
              <option value="" disabled>Choose…</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>{e.empCode} · {e.name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 sm:col-span-1">
              <span className={field.label}>Date</span>
              <input type="date" name="date" required defaultValue={defaultDate} className={field.input} />
            </label>
            <label>
              <span className={field.label}>In</span>
              <input type="time" name="inTime" required defaultValue="09:00" className={field.input} />
            </label>
            <label>
              <span className={field.label}>Out</span>
              <input type="time" name="outTime" defaultValue="17:30" className={field.input} />
            </label>
            <label>
              <span className={field.label}>Paused</span>
              <input type="number" name="pausedMinutes" min="0" defaultValue={0} className={field.input} />
            </label>
          </div>
          <label className="block">
            <span className={field.label}>Note (optional)</span>
            <input name="reason" placeholder="e.g. Entered from paper register" className={field.input} />
          </label>
          <FormError message={error} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>Cancel</button>
            <button type="submit" disabled={pending} className={btn.primary}>{pending ? "Saving…" : "Add record"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
