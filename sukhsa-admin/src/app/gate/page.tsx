import type { Metadata } from "next";
import { auth } from "@/auth";
import { gateBoard } from "@/lib/services/gate";
import { teamEmployeeIds } from "@/lib/services/teams";
import { dayLabel } from "@/lib/dates";
import { PageHeader } from "@/components/ui/ui";
import { GateBoard } from "@/components/gate/GateBoard";

export const metadata: Metadata = { title: "Gate Desk · Sukhsa Exports" };
export const dynamic = "force-dynamic";

/** Mark In / Pause / Resume / Out. Supervisors see only their team. (Access is checked in the layout.) */
export default async function GatePage() {
  const session = await auth();
  const isSupervisor = session?.user?.role === "supervisor";
  const board = await gateBoard(isSupervisor ? await teamEmployeeIds(session!.user.id) : undefined);

  return (
    <div className="animate-rise">
      <PageHeader title="Gate Desk" subtitle={`${dayLabel(board.today)} · ${isSupervisor ? "your team" : "all active employees"}`} />
      <GateBoard initial={board} />
    </div>
  );
}
