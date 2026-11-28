import Link from "next/link";
import type { Metadata } from "next";
import { Network, UserCog } from "lucide-react";
import { auth } from "@/auth";
import { listSupervisors } from "@/lib/services/teams";
import { listEmployees } from "@/lib/services/employees";
import { Badge, Card, EmptyState, PageHeader, btn } from "@/components/ui/ui";
import { TeamDialog, type TeamEmployee } from "@/components/admin/TeamDialog";

export const metadata: Metadata = { title: "Teams · Sukhsa Exports" };

export default async function TeamsPage() {
  const [supervisors, employees, session] = await Promise.all([listSupervisors(), listEmployees({ active: true }), auth()]);
  const names = Object.fromEntries(supervisors.map((s) => [s.id, s.name]));
  const team: TeamEmployee[] = employees.map((e) => ({ id: e._id, empCode: e.empCode, name: e.name, department: e.department, supervisorId: e.supervisorId ?? null }));
  const unassigned = team.filter((e) => !e.supervisorId || !names[e.supervisorId]).length;

  return (
    <div className="animate-rise">
      <PageHeader
        title="Teams"
        subtitle={`Assign workers to supervisors. Supervisors only see and manage their own team. ${unassigned} of ${team.length} active employees are not in a team.`}
        actions={
          session?.user?.role === "super_admin" ? (
            <Link href="/ceo/users" className={btn.secondary}>
              <UserCog className="size-4" /> Add a supervisor
            </Link>
          ) : undefined
        }
      />
      {supervisors.length === 0 ? (
        <Card>
          <EmptyState icon={Network} title="No supervisors yet">
            The Super Admin adds supervisors under Users &amp; roles (role &ldquo;Supervisor&rdquo;). Then assign their workers here.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {supervisors.map((s) => {
            const members = team.filter((e) => e.supervisorId === s.id);
            return (
              <Card key={s.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-bold text-ink">{s.name}</div>
                    <div className="truncate text-xs text-ink-faint">{s.email}</div>
                  </div>
                  {s.active ? <Badge tone="green">{s.teamSize} workers</Badge> : <Badge>No access</Badge>}
                </div>
                <ul className="mt-4 flex-1 space-y-1">
                  {members.slice(0, 6).map((m) => (
                    <li key={m.id} className="truncate text-sm text-ink-soft">
                      <span className="font-medium text-ink">{m.name}</span> · {m.empCode}
                    </li>
                  ))}
                  {members.length > 6 && <li className="text-xs text-ink-faint">+{members.length - 6} more</li>}
                  {members.length === 0 && <li className="text-sm text-ink-faint">No workers assigned yet.</li>}
                </ul>
                <div className="mt-4">
                  <TeamDialog supervisorId={s.id} supervisorName={s.name} employees={team} supervisorNames={names} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
