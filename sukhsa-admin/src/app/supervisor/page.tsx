import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Coffee, DoorOpen, LogIn, UserRound, Users, Wrench } from "lucide-react";
import { auth } from "@/auth";
import { teamEmployeeIds } from "@/lib/services/teams";
import { gateBoard } from "@/lib/services/gate";
import { listAttendance } from "@/lib/services/attendance";
import { currentMonthIST, dayLabel, fmtMinutes, monthLabel } from "@/lib/dates";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, btn, table } from "@/components/ui/ui";

export const metadata: Metadata = { title: "My team · Sukhsa Exports" };
export const dynamic = "force-dynamic";

const STATE = {
  not_in: { label: "Not in", tone: "gray" as const, Icon: UserRound },
  on_duty: { label: "Inside", tone: "green" as const, Icon: LogIn },
  paused: { label: "On break", tone: "amber" as const, Icon: Coffee },
  done: { label: "Done", tone: "gray" as const, Icon: CheckCircle2 },
};

/** Supervisor dashboard: only their own team (no pay information). */
export default async function SupervisorHome() {
  const session = await auth();
  const user = session!.user;
  const team = await teamEmployeeIds(user.id);
  const month = currentMonthIST();
  const [board, monthRecs] = await Promise.all([gateBoard(team), team.length ? listAttendance({ month }, team) : Promise.resolve([])]);

  const byEmp = new Map<string, { days: number; present: number; minutes: number }>();
  for (const r of monthRecs) {
    const s = byEmp.get(r.employeeId) ?? { days: 0, present: 0, minutes: 0 };
    s.days += 1;
    s.present += r.calc?.presentDays ?? 0;
    s.minutes += r.calc?.netMinutes ?? 0;
    byEmp.set(r.employeeId, s);
  }
  const first = (user.name ?? user.email ?? "").split(/[\s@]/)[0];

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title={`Hello, ${first}`}
        subtitle={`Your team · ${dayLabel(board.today)}`}
        actions={
          team.length ? (
            <Link href="/gate" className={btn.primary}>
              <DoorOpen className="size-4" /> Open Gate Desk
            </Link>
          ) : undefined
        }
      />

      {team.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No workers in your team yet">Ask Accounts (Admin) to assign your workers under Teams.</EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Users} label="Team size" value={team.length} tone="ink" />
            <StatCard icon={LogIn} label="Inside now" value={board.counts.inside} />
            <StatCard icon={Coffee} label="On break" value={board.counts.paused} tone="accent" />
            <StatCard icon={CheckCircle2} label="Done today" value={board.counts.done} hint={`${board.counts.notIn} not in yet`} tone="ink" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Today" action={<Link href="/gate" className="text-xs font-semibold text-brand">Gate Desk</Link>} />
              <div className={table.wrap}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th className={table.th}>Worker</th>
                      <th className={table.th}>Status</th>
                      <th className={table.th}>In</th>
                      <th className={table.th}>Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.rows.map((r) => {
                      const s = STATE[r.state];
                      return (
                        <tr key={r.employeeId} className={table.row}>
                          <td className={table.tdStrong}>
                            {r.name} <span className="font-normal text-ink-faint">· {r.empCode}</span>
                          </td>
                          <td className={table.td}><Badge tone={s.tone}><s.Icon className="size-3" /> {s.label}</Badge></td>
                          <td className={table.td}>{r.record?.inTime ?? "—"}</td>
                          <td className={table.td}>{r.record?.outTime ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title={`${monthLabel(month)} so far`} action={<Link href="/supervisor/attendance" className="text-xs font-semibold text-brand">Details</Link>} />
                <ul className="divide-y divide-line">
                  {board.rows.map((r) => {
                    const s = byEmp.get(r.employeeId);
                    return (
                      <li key={r.employeeId} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                        <span className="truncate font-medium text-ink">{r.name}</span>
                        <span className="shrink-0 tabular-nums text-ink-soft">
                          {s ? `${s.present} P · ${fmtMinutes(s.minutes)}` : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-faint"><Wrench className="size-5" /></span>
                  <div>
                    <div className="font-semibold text-ink">Work allotment</div>
                    <p className="mt-0.5 text-sm text-ink-soft">Assigning daily work and timers to your team will appear here.</p>
                    <Link href="/supervisor/attendance" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                      Team attendance <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
