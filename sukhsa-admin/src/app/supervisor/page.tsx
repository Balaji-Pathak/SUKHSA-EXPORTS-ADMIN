import type { Metadata } from "next";
import { CalendarCheck, Factory, ClipboardList, Clock } from "lucide-react";
import { requireRole } from "@/lib/session";
import { SUPERVISOR_ROLES } from "@/lib/access";
import { PanelShell } from "@/components/panel/PanelShell";
import { WelcomeCard } from "@/components/panel/WelcomeCard";

export const metadata: Metadata = { title: "Supervisor · Sukhsa Exports" };

export default async function SupervisorHome() {
  const user = await requireRole(SUPERVISOR_ROLES);
  return (
    <PanelShell user={user}>
      <WelcomeCard
        name={user.name}
        email={user.email}
        role={user.role}
        modules={[
          { icon: CalendarCheck, title: "Today's attendance", description: "Who is in, paused or out right now." },
          { icon: Clock, title: "Shift review", description: "Check short shifts and missing Out times." },
          { icon: Factory, title: "Production", description: "Record daily output by team." },
          { icon: ClipboardList, title: "Team", description: "Your workers and their departments." },
        ]}
      />
    </PanelShell>
  );
}
