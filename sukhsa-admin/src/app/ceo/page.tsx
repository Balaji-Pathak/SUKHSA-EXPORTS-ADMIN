import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Clock, DoorOpen, IndianRupee, TriangleAlert, Users, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { ceoOverview } from "@/lib/services/ceo";
import { dayLabel, fmtRupees } from "@/lib/dates";
import { Card, CardHeader, EmptyState, PageHeader, StatCard, btn } from "@/components/ui/ui";
import { RunStatus } from "@/components/admin/RunStatus";

export const metadata: Metadata = { title: "CEO Overview · Sukhsa Exports" };
export const dynamic = "force-dynamic";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const compact = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)} K` : `₹${Math.round(n)}`);

export default async function CeoOverview() {
  const [o, session] = await Promise.all([ceoOverview(), auth()]);
  const first = (session?.user?.name ?? session?.user?.email ?? "").split(/[\s@]/)[0];
  const max = Math.max(1, ...o.trend.map((t) => t.total));
  const pendingTotal = o.pending.reduce((s, p) => s + p.total, 0);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader title={`${greeting()}, ${first}`} subtitle={`Company overview · ${dayLabel(o.today)}`} />

      {/* Approvals first: this is the CEO's main job here */}
      {o.pending.length > 0 ? (
        <Card className="border-accent/40 ring-1 ring-accent/20">
          <CardHeader title={`Payroll waiting for your approval · ${fmtRupees(pendingTotal)}`} action={<Link href="/ceo/approvals" className="text-xs font-semibold text-brand">All approvals</Link>} />
          <ul className="divide-y divide-line">
            {o.pending.map((p) => (
              <li key={p.month} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-bold text-ink">{p.label}</div>
                  <div className="text-xs text-ink-faint">
                    {p.employees} staff · submitted by {p.by} on {new Date(p.at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-extrabold tabular-nums text-ink">{fmtRupees(p.total)}</span>
                  <Link href={`/admin/payroll?month=${p.month}`} className={btn.primary}>
                    Review <ArrowRight className="size-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-ink-soft shadow-soft">
          <CheckCircle2 className="size-5 text-brand" /> No payroll is waiting for your approval.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BadgeCheck} label="Waiting approval" value={fmtRupees(pendingTotal)} hint={`${o.pending.length} month(s)`} tone="accent" />
        <StatCard icon={IndianRupee} label={`${o.thisMonth.label} so far`} value={fmtRupees(o.thisMonth.total)} hint={`${o.thisMonth.hours} h worked · ${o.thisMonth.present} P`} />
        <StatCard icon={Users} label="Active staff" value={o.headcount.total} hint={`${o.headcount.permanent} permanent · ${o.headcount.temporary} temporary`} tone="ink" />
        <StatCard icon={DoorOpen} label="Inside now" value={o.gate.inside + o.gate.paused} hint={`${o.gate.done} done today · ${o.gate.notIn} not in`} tone="ink" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Payroll · last 6 months" action={<Link href="/admin/payroll" className="text-xs font-semibold text-brand">Open payroll</Link>} />
          <div className="px-5 pb-5 pt-6">
            <div className="flex h-48 items-end gap-3 sm:gap-5" role="img" aria-label="Monthly payroll for the last 6 months">
              {o.trend.map((t) => (
                <Link key={t.month} href={`/admin/payroll?month=${t.month}`} className="group flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${t.label}: ${fmtRupees(t.total)}`}>
                  <span className="text-[11px] font-semibold tabular-nums text-ink-soft">{t.total ? compact(t.total) : "—"}</span>
                  <span
                    className={`w-full max-w-14 rounded-t-lg transition group-hover:opacity-80 ${t.status === "paid" || t.status === "approved" ? "bg-brand" : t.status === "submitted" ? "bg-accent" : "bg-brand/30"}`}
                    style={{ height: `${Math.max(3, (t.total / max) * 100)}%` }}
                  />
                  <span className="text-xs font-medium text-ink-faint">{t.label.split(" ")[0].slice(0, 3)}</span>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-faint">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" /> Approved / paid</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent" /> Waiting approval</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand/30" /> Draft / in progress</span>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent payroll months" />
            {o.recentRuns.length === 0 ? (
              <EmptyState icon={IndianRupee} title="No payroll submitted yet">Accounts submits each month here for your approval.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {o.recentRuns.map((r) => (
                  <li key={r.month}>
                    <Link href={`/admin/payroll?month=${r.month}`} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-surface-2/50">
                      <span>
                        <span className="block font-semibold text-ink">{r.label}</span>
                        <RunStatus status={r.status} />
                      </span>
                      <span className="font-bold tabular-nums text-ink">{fmtRupees(r.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {o.openShifts > 0 && (
            <Link href="/admin/attendance?status=open" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-500/5 px-4 py-3 text-sm text-ink">
              <TriangleAlert className="size-5 text-red-600" /> <span><b>{o.openShifts}</b> earlier shift(s) still have no Out time</span>
            </Link>
          )}
          <Link href="/gate" className="flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4 shadow-soft transition hover:border-brand/40">
            <span className="flex items-center gap-3">
              <Clock className="size-5 text-brand" />
              <span>
                <span className="block font-semibold text-ink">Gate Desk</span>
                <span className="text-xs text-ink-faint">{o.gate.inside} inside · {o.gate.paused} on break</span>
              </span>
            </span>
            <ArrowRight className="size-4 text-ink-faint" />
          </Link>
        </div>
      </div>
    </div>
  );
}
