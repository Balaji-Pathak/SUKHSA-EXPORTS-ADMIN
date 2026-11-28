import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { listGuards } from "@/lib/services/guards";
import { Badge, Card, EmptyState, PageHeader, btn, table } from "@/components/ui/ui";
import { AddGuard, GuardRowActions } from "@/components/admin/GuardActions";

export const metadata: Metadata = { title: "Guards · Sukhsa Exports Admin" };

export default async function GuardsPage() {
  const guards = await listGuards();
  return (
    <div className="animate-rise">
      <PageHeader
        title="Guards"
        subtitle="Username + password logins for the Gate Desk. Guards only see the Gate Desk."
        actions={
          <>
            <Link href="/gate" className={btn.secondary}>
              <ExternalLink className="size-4" /> Open Gate Desk
            </Link>
            <AddGuard />
          </>
        }
      />
      <Card>
        {guards.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No guard logins yet">Create one so the gate can mark attendance.</EmptyState>
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Username</th>
                  <th className={table.th}>Name</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th}>Last sign-in</th>
                  <th className={`${table.th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {guards.map((g) => (
                  <tr key={g._id} className={table.row}>
                    <td className={`${table.tdStrong} font-mono`}>{g.username}</td>
                    <td className={table.td}>{g.displayName || "—"}</td>
                    <td className={table.td}>
                      {!g.active ? <Badge>Inactive</Badge> : g.lockedUntil && new Date(g.lockedUntil) > new Date() ? <Badge tone="red">Paused (wrong passwords)</Badge> : <Badge tone="green">Active</Badge>}
                    </td>
                    <td className={table.td}>
                      {g.lastLoginAt ? new Date(g.lastLoginAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "Never (here)"}
                    </td>
                    <td className={`${table.td} text-right`}>
                      <GuardRowActions id={g._id} username={g.username!} active={g.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-4 text-xs text-ink-faint">Existing guards keep the same password they used on attendance.sukhsa.in.</p>
    </div>
  );
}
