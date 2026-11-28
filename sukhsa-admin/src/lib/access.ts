/**
 * Roles and what each section allows. Safe to import anywhere (also in middleware).
 *
 *   super_admin  CEO: everything + approves payroll, manages users and roles
 *   admin        Accountant: employees, attendance, Theka, guards, teams; prepares and submits payroll
 *   supervisor   Floor lead: only their own team
 *   guard        Gate Desk only
 */
export type PanelRole = "super_admin" | "admin" | "supervisor";
/** Everyone who can sign in: panel users (Google) and guards (username + password). */
export type AppRole = PanelRole | "guard";

export const PANEL_ROLES: PanelRole[] = ["super_admin", "admin", "supervisor"];
/** CEO-only area (/ceo): executive dashboard, payroll approvals, users & roles. */
export const CEO_ROLES: AppRole[] = ["super_admin"];
/** Accounts area (/admin): employees, attendance, payroll preparation, guards, teams. */
export const ADMIN_ROLES: AppRole[] = ["super_admin", "admin"];
/** Supervisor area (/supervisor). The CEO may look in too. */
export const SUPERVISOR_ROLES: AppRole[] = ["super_admin", "supervisor"];
/** Read access to employees/attendance through the API (supervisors are limited to their team). */
export const STAFF_READ_ROLES: AppRole[] = ["super_admin", "admin", "supervisor"];
/** Who may use the Gate Desk (supervisors only for their team). */
export const GATE_ROLES: AppRole[] = ["super_admin", "admin", "supervisor", "guard"];

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  supervisor: "Supervisor",
  guard: "Guard",
};

/** Where each role lands after signing in. */
export const homeFor = (role: AppRole) =>
  role === "super_admin" ? "/ceo" : role === "admin" ? "/admin" : role === "supervisor" ? "/supervisor" : "/gate";
