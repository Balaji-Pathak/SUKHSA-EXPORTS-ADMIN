import type { Metadata } from "next";
import { ShieldX, UserCog } from "lucide-react";
import { auth } from "@/auth";
import { listPanelUsers } from "@/lib/services/users";
import { ROLE_LABEL, type PanelRole } from "@/lib/access";
import { Badge, Card, EmptyState, PageHeader, table } from "@/components/ui/ui";
import { AddUser, UserRowActions } from "@/components/admin/UserActions";

export const metadata: Metadata = { title: "Users & roles · Sukhsa Exports Admin" };

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return (
      <Card>
        <EmptyState icon={ShieldX} title="Super Admin only">Only a Super Admin can manage who has access.</EmptyState>
      </Card>
    );
  }
  const users = await listPanelUsers();
  const lastLogin = (u: (typeof users)[number]) => (u as { lastLoginAt?: Date }).lastLoginAt;

  return (
    <div className="animate-rise">
      <PageHeader title="Users & roles" subtitle="Who can sign in to the admin panel, and what they can do" actions={<AddUser />} />
      <Card>
        {users.length === 0 ? (
          <EmptyState icon={UserCog} title="No users yet" />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Email</th>
                  <th className={table.th}>Role</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th}>Last sign-in</th>
                  <th className={`${table.th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const ll = lastLogin(u);
                  return (
                    <tr key={u._id} className={table.row}>
                      <td className={table.tdStrong}>
                        {u.email}
                        {u.displayName && <span className="block text-xs font-normal text-ink-faint">{u.displayName}</span>}
                      </td>
                      <td className={table.td}>
                        <Badge tone={u.role === "super_admin" ? "green" : u.role === "admin" ? "blue" : "amber"}>{ROLE_LABEL[u.role as PanelRole]}</Badge>
                      </td>
                      <td className={table.td}>{u.active ? <Badge tone="green">Active</Badge> : <Badge>No access</Badge>}</td>
                      <td className={table.td}>
                        {ll ? new Date(ll).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "Never"}
                      </td>
                      <td className={`${table.td} text-right`}>
                        <UserRowActions id={u._id} role={u.role} active={u.active} isSelf={u.email === session.user.email} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-4 text-xs text-ink-faint">
        Removing access takes effect within 5 minutes, even for someone already signed in. Guards (Gate Desk) are managed separately.
      </p>
    </div>
  );
}
