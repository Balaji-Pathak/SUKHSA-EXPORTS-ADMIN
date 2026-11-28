"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogIn, LogOut, Pause, Play, Search, CheckCircle2, Coffee, UserRound, RefreshCw } from "lucide-react";
import { api } from "@/lib/client/api";

type State = "not_in" | "on_duty" | "paused" | "done";
interface Row {
  employeeId: string;
  empCode: string;
  name: string;
  department: string;
  category: "permanent" | "temporary";
  state: State;
  record: {
    _id: string;
    date: string;
    inTime: string;
    outTime: string | null;
    pausedSeconds: number;
    startedAtMs: number | null;
    isPaused: boolean;
    pausedAtMs: number | null;
    netMinutes: number | null;
    status: string;
  } | null;
}
interface Board {
  today: string;
  serverNowMs: number;
  rows: Row[];
  counts: { total: number; inside: number; paused: number; done: number; notIn: number };
}

const pad = (n: number) => String(n).padStart(2, "0");
const hms = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const hm = (min: number) => `${Math.floor(min / 60)}h ${pad(Math.round(min % 60))}m`;
const to12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};

/** Seconds worked so far on an open shift (paused time excluded). */
function workedSeconds(r: NonNullable<Row["record"]>, now: number) {
  const start = r.startedAtMs ?? Date.parse(`${r.date}T${r.inTime.padStart(5, "0")}:00+05:30`);
  const runningPause = r.isPaused && r.pausedAtMs ? now - r.pausedAtMs : 0;
  return (now - start - r.pausedSeconds * 1000 - runningPause) / 1000;
}
function awaySeconds(r: NonNullable<Row["record"]>, now: number) {
  return r.pausedSeconds + (r.isPaused && r.pausedAtMs ? (now - r.pausedAtMs) / 1000 : 0);
}

const FILTERS: { key: "all" | State; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not_in", label: "Not in" },
  { key: "on_duty", label: "Inside" },
  { key: "paused", label: "On break" },
  { key: "done", label: "Done" },
];

export function GateBoard({ initial }: { initial: Board }) {
  const [board, setBoard] = useState(initial);
  const [offset] = useState(() => initial.serverNowMs - Date.now()); // trust the server clock
  const [now, setNow] = useState(() => Date.now() + offset);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | State>("all");
  const [cat, setCat] = useState<"all" | "permanent" | "temporary">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null); // employeeId waiting for a 2nd tap on Out
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refresh = useCallback(async () => {
    try {
      setBoard(await api<Board>("/api/v1/gate"));
    } catch {
      /* keep showing the last data; next poll retries */
    }
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offset), 1000);
    const poll = setInterval(refresh, 15000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [offset, refresh]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const say = (text: string, ok = true) => {
    setToast({ text, ok });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const act = async (row: Row, action: "in" | "pause" | "resume" | "out") => {
    if (action === "out" && armed !== row.employeeId) {
      setArmed(row.employeeId);
      return;
    }
    setArmed(null);
    setBusy(row.employeeId);
    try {
      const res = await api<{ netMinutes?: number }>(`/api/v1/gate/${encodeURIComponent(row.employeeId)}`, { body: { action } });
      const msg = {
        in: `${row.name} marked IN`,
        pause: `${row.name} on break`,
        resume: `${row.name} back from break`,
        out: `${row.name} marked OUT · worked ${hm(res.netMinutes ?? 0)}`,
      }[action];
      say(msg);
      await refresh();
    } catch (e) {
      say((e as Error).message, false);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return board.rows.filter(
      (r) =>
        (filter === "all" || r.state === filter) &&
        (cat === "all" || r.category === cat) &&
        (!s || r.name.toLowerCase().includes(s) || r.empCode.toLowerCase().includes(s) || r.department.toLowerCase().includes(s)),
    );
  }, [board.rows, q, filter, cat]);

  const countFor = (k: "all" | State) =>
    k === "all" ? board.counts.total : k === "not_in" ? board.counts.notIn : k === "on_duty" ? board.counts.inside : k === "paused" ? board.counts.paused : board.counts.done;

  return (
    <div>
      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Inside now", value: board.counts.inside, cls: "text-brand" },
          { label: "On break", value: board.counts.paused, cls: "text-accent" },
          { label: "Done today", value: board.counts.done, cls: "text-ink" },
          { label: "Not in yet", value: board.counts.notIn, cls: "text-ink-faint" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{s.label}</div>
            <div className={`mt-1 text-3xl font-extrabold tabular-nums ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="sticky top-16 z-10 -mx-4 mb-4 space-y-3 bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or employee code"
              className="w-full rounded-2xl border border-line bg-surface py-3.5 pl-11 pr-4 text-base text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <button type="button" onClick={refresh} className="grid w-12 place-items-center rounded-2xl border border-line bg-surface text-ink-soft hover:text-ink" aria-label="Refresh">
            <RefreshCw className="size-5" />
          </button>
        </div>
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition ${filter === f.key ? "bg-ink text-bg" : "bg-surface text-ink-soft hover:text-ink"}`}
            >
              {f.label} <span className="opacity-60">{countFor(f.key)}</span>
            </button>
          ))}
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value as typeof cat)}
            className="ml-auto shrink-0 rounded-full border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-soft"
            aria-label="Company category"
          >
            <option value="all">All companies</option>
            <option value="permanent">Permanent</option>
            <option value="temporary">Temporary</option>
          </select>
        </div>
      </div>

      {/* Employee cards */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center text-ink-soft">No employees match.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const rec = r.record;
            const isBusy = busy === r.employeeId;
            const tone =
              r.state === "on_duty" ? "border-brand/40 ring-1 ring-brand/20" : r.state === "paused" ? "border-accent/50 ring-1 ring-accent/20" : "border-line";
            return (
              <div key={r.employeeId} className={`flex flex-col rounded-2xl border bg-surface p-4 shadow-soft transition ${tone} ${r.state === "done" ? "opacity-75" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-bold text-ink">{r.name}</div>
                    <div className="text-sm text-ink-faint">
                      {r.empCode} · {r.department || "—"}
                    </div>
                  </div>
                  <StateBadge state={r.state} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-center">
                  <Stat label="In" value={rec ? to12(rec.inTime) : "—"} />
                  <Stat label="Away" value={rec ? hm(awaySeconds(rec, now) / 60) : "—"} />
                  <Stat
                    label={r.state === "done" ? "Worked" : "Working"}
                    value={!rec ? "—" : r.state === "done" ? hm(rec.netMinutes ?? 0) : hms(workedSeconds(rec, now))}
                    strong
                  />
                </div>
                {rec && rec.date !== board.today && r.state !== "done" && (
                  <div className="mt-2 rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent">Overnight shift from {rec.date}</div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {r.state === "not_in" && (
                    <Btn className="col-span-2 bg-brand text-white" onClick={() => act(r, "in")} disabled={isBusy} icon={LogIn}>
                      Mark IN
                    </Btn>
                  )}
                  {r.state === "on_duty" && (
                    <Btn className="bg-accent-soft text-accent" onClick={() => act(r, "pause")} disabled={isBusy} icon={Pause}>
                      Pause
                    </Btn>
                  )}
                  {r.state === "paused" && (
                    <Btn className="bg-brand text-white" onClick={() => act(r, "resume")} disabled={isBusy} icon={Play}>
                      Resume
                    </Btn>
                  )}
                  {(r.state === "on_duty" || r.state === "paused") && (
                    <Btn
                      className={armed === r.employeeId ? "bg-red-600 text-white" : "bg-ink text-bg"}
                      onClick={() => act(r, "out")}
                      disabled={isBusy}
                      icon={LogOut}
                    >
                      {armed === r.employeeId ? "Tap again" : "Mark OUT"}
                    </Btn>
                  )}
                  {r.state === "done" && rec && (
                    <div className="col-span-2 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-ink-soft">
                      <CheckCircle2 className="size-4 text-brand" /> Out at {to12(rec.outTime!)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-5 z-30 mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-soft sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 ${toast.ok ? "bg-ink text-bg" : "bg-red-600 text-white"}`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`truncate tabular-nums ${strong ? "text-base font-extrabold text-ink" : "text-sm font-semibold text-ink-soft"}`}>{value}</div>
    </div>
  );
}

function StateBadge({ state }: { state: State }) {
  const map = {
    not_in: { text: "Not in", cls: "bg-surface-2 text-ink-faint", Icon: UserRound },
    on_duty: { text: "Inside", cls: "bg-brand-soft text-brand", Icon: LogIn },
    paused: { text: "On break", cls: "bg-accent-soft text-accent", Icon: Coffee },
    done: { text: "Done", cls: "bg-surface-2 text-ink-soft", Icon: CheckCircle2 },
  }[state];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${map.cls}`}>
      <map.Icon className="size-3.5" /> {map.text}
    </span>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  icon: Icon,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon: typeof LogIn;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
