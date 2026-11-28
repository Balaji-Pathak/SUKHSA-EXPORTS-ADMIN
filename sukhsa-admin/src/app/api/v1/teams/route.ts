import { withAuth } from "@/lib/api/http";
import { ADMIN_ROLES } from "@/lib/access";
import { listSupervisors } from "@/lib/services/teams";

/** GET /api/v1/teams  -> supervisors with team sizes (Admin) */
export const GET = withAuth(ADMIN_ROLES, async () => ({ supervisors: await listSupervisors() }));
