import type { Metadata } from "next";
import { Users, CalendarCheck, IndianRupee, UserCog } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ADMIN_ROLES } from "@/lib/access";
import { PanelShell } from "@/components/panel/PanelShell";
import { WelcomeCard } from "@/components/panel/WelcomeCard";

export const metadata: Metadata = { title: "Admin · Sukhsa Exports" };

export default async function AdminHome() {
  const user = await requireRole(ADMIN_ROLES);
  return (
    <PanelShell user={user}>
      <WelcomeCard
        name={user.name}
        email={user.email}
        role={user.role}
        modules={[
          { icon: Users, title: "Employees", description: "Add, edit and deactivate staff, rates and categories." },
          { icon: CalendarCheck, title: "Attendance", description: "Daily In/Out records and corrections." },
          { icon: IndianRupee, title: "Payroll", description: "Monthly hours, Theka and payable amounts." },
          { icon: UserCog, title: "Users & roles", description: "Approve admins, supervisors and guards." },
        ]}
      />
    </PanelShell>
  );
}
