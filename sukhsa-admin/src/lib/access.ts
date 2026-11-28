/** Which roles may sign in to the web panel, and what each section allows. Safe to import anywhere. */
export type PanelRole = "super_admin" | "admin" | "supervisor";

export const PANEL_ROLES: PanelRole[] = ["super_admin", "admin", "supervisor"];
export const ADMIN_ROLES: PanelRole[] = ["super_admin", "admin"];
export const SUPERVISOR_ROLES: PanelRole[] = ["super_admin", "admin", "supervisor"];

export const ROLE_LABEL: Record<PanelRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  supervisor: "Supervisor",
};

/** Where each role lands after signing in. */
export const homeFor = (role: PanelRole) => (role === "supervisor" ? "/supervisor" : "/admin");
