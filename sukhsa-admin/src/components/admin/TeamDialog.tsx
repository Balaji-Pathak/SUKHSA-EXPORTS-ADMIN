"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, UsersRound } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { btn, field } from "@/components/ui/ui";
import { api } from "@/lib/client/api";

export interface TeamEmployee {
  id: string;
  empCode: string;
  name: string;
  department: string;
  supervisorId: string | null;
}

/** Pick which employees are in a supervisor's team. Employees in another team move here when ticked. */
export function TeamDialog({
  supervisorId,
  supervisorName,
  employees,
  supervisorNames,
}: {
  supervisorId: string;
  supervisorName: string;
  employees: TeamEmployee[];
  supervisorNames: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(employees.filter((e) => e.supervisorId === supervisorId).map((e) => e.id)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return employees.filter((e) => !s || e.name.toLowerCase().includes(s) || e.empCode.toLowerCase().includes(s) || e.department.toLowerCase().includes(s));
  }, [employees, q]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const save = () => {
    setError(null);
    start(async () => {
      try {
        await api(`/api/v1/teams/${encodeURIComponent(supervisorId)}`, { method: "PUT", body: { employeeIds: [...selected] } });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelected(new Set(employees.filter((e) => e.supervisorId === supervisorId).map((e) => e.id)));
          setOpen(true);
        }}
        className={btn.secondary}
      >
        <UsersRound className="size-4" /> Manage team
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${supervisorName}'s team`}>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employees" className={`${field.input} pl-9`} />
          </div>
          <div className="flex items-center justify-between text-xs text-ink-faint">
            <span>{selected.size} selected</span>
            <button type="button" className="font-semibold text-brand" onClick={() => setSelected(new Set())}>Clear all</button>
          </div>
          <ul className="no-scrollbar max-h-[45dvh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {shown.map((e) => {
              const other = e.supervisorId && e.supervisorId !== supervisorId ? supervisorNames[e.supervisorId] : null;
              return (
                <li key={e.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2/60">
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="size-4 accent-[var(--brand)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{e.name}</span>
                      <span className="text-xs text-ink-faint">
                        {e.empCode} · {e.department || "—"}
                        {other && <span className="text-accent"> · now in {other}&apos;s team</span>}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <FormError message={error} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>Cancel</button>
            <button type="button" onClick={save} disabled={pending} className={btn.primary}>{pending ? "Saving…" : "Save team"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
