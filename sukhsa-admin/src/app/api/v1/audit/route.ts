import { withAuth, searchParams } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { listAudit } from "@/lib/services/audit";
import type { AuditEntry } from "@/lib/schema";

const ENTITIES = new Set(["employee", "attendance", "theka", "user", "payroll", "guard"]);

/** GET /api/v1/audit?entity=employee&entityId=emp-...&limit=50 */
export const GET = withAuth(ADMIN_ROLES, async (req) => {
  const p = searchParams(req);
  const entity = ENTITIES.has(p.entity) ? (p.entity as AuditEntry["entity"]) : undefined;
  return { entries: await listAudit({ entity, entityId: p.entityId, limit: Number(p.limit) || 50 }) };
});
