import type { Metadata } from "next";
import { listAudit } from "@/lib/services/audit";
import { Card, PageHeader } from "@/components/ui/ui";
import { AuditList } from "@/components/admin/AuditList";

export const metadata: Metadata = { title: "Activity log · Sukhsa Exports Admin" };

export default async function ActivityPage() {
  const entries = await listAudit({ limit: 150 });
  return (
    <div className="animate-rise">
      <PageHeader title="Activity log" subtitle="Every change made in the panel: who, what, when and why" />
      <Card>
        <AuditList entries={entries} showEntity />
      </Card>
    </div>
  );
}
