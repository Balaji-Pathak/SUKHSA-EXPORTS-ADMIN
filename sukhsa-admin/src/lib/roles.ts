import { ShieldCheck, ClipboardList, DoorOpen, type LucideIcon } from "lucide-react";

export type LoginRole = "admin" | "supervisor" | "guard";

export interface RoleInfo {
  slug: LoginRole;
  title: string;
  subtitle: string;
  description: string;
  method: "google" | "password";
  icon: LucideIcon;
  tone: "brand" | "accent" | "ink";
}

export const ROLES: RoleInfo[] = [
  {
    slug: "admin",
    title: "Admin",
    subtitle: "Super Admin & Admin",
    description: "Employees, payroll, Theka, reports and system settings.",
    method: "google",
    icon: ShieldCheck,
    tone: "brand",
  },
  {
    slug: "supervisor",
    title: "Supervisor",
    subtitle: "Floor & team leads",
    description: "Team attendance, daily production and shift review.",
    method: "google",
    icon: ClipboardList,
    tone: "accent",
  },
  {
    slug: "guard",
    title: "Guard",
    subtitle: "Gate Desk",
    description: "Mark In, Pause, Resume and Out at the factory gate.",
    method: "password",
    icon: DoorOpen,
    tone: "ink",
  },
];

export const roleBySlug = (slug: string) => ROLES.find((r) => r.slug === slug);
