import {
  ArrowLeftRight,
  CalendarClock,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { RoomDutyFlags } from "@/modules/shared/exams/types/exam.types";

/**
 * Operational dashboard roles (Invigilator, RS, DCS) share the same page set
 * and only differ in which "role slot" they own on a given exam room. The
 * Controller (cs) is a separate flow and is not covered by this config.
 */
export type OperationalRole = "invigilator" | "rs" | "dcs";

export interface RoleNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface RoleDashboardConfig {
  /** The auth-store role value this config applies to. */
  roleKey: OperationalRole;
  /** Singular human label. */
  roleLabel: string;
  /** Plural / section header — e.g. "Invigilator" in the sidebar. */
  sectionLabel: string;
  /** Route base — e.g. "/invigilator", "/rs". */
  basePath: string;
  /** Default landing path inside this dashboard. */
  defaultPath: string;
  /** RoomDutyFlags boolean key indicating this role's slot occupancy. */
  flagKey: "invigilatorAssigned" | "rsAssigned" | "dcsAssigned";
  /** Sidebar nav items. */
  navItems: RoleNavItem[];
}

/**
 * Shared module list — both Invigilator and RS expose identical structure,
 * only the base path differs. Source of truth lives here so both sidebars
 * stay in lockstep.
 */
const buildNav = (basePath: string): RoleNavItem[] => [
  { path: `${basePath}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
  { path: `${basePath}/exams`, label: "Exams", icon: FileText },
  { path: `${basePath}/select-duty`, label: "Select Duty", icon: ClipboardCheck },
  { path: `${basePath}/upcoming-duties`, label: "Upcoming Duties", icon: CalendarClock },
  { path: `${basePath}/messages`, label: "Messages", icon: MessageSquare },
  { path: `${basePath}/change-requests`, label: "Change Requests", icon: ArrowLeftRight },
];

export const INVIGILATOR_CONFIG: RoleDashboardConfig = {
  roleKey: "invigilator",
  roleLabel: "Invigilator",
  sectionLabel: "Invigilator",
  basePath: "/invigilator",
  defaultPath: "/invigilator/dashboard",
  flagKey: "invigilatorAssigned",
  navItems: buildNav("/invigilator"),
};

export const RS_CONFIG: RoleDashboardConfig = {
  roleKey: "rs",
  roleLabel: "RS",
  sectionLabel: "Room Superintendent",
  basePath: "/rs",
  defaultPath: "/rs/dashboard",
  flagKey: "rsAssigned",
  navItems: buildNav("/rs"),
};

export const DCS_CONFIG: RoleDashboardConfig = {
  roleKey: "dcs",
  roleLabel: "DCS",
  sectionLabel: "Deputy Chief Superintendent",
  basePath: "/dcs",
  defaultPath: "/dcs/dashboard",
  flagKey: "dcsAssigned",
  navItems: buildNav("/dcs"),
};

const CONFIGS: Record<OperationalRole, RoleDashboardConfig> = {
  invigilator: INVIGILATOR_CONFIG,
  rs: RS_CONFIG,
  dcs: DCS_CONFIG,
};

export function getRoleConfig(
  role: string | null | undefined,
): RoleDashboardConfig | null {
  if (!role) return null;
  return CONFIGS[role as OperationalRole] || null;
}

export function isOperationalRole(
  role: string | null | undefined,
): role is OperationalRole {
  return role === "invigilator" || role === "rs" || role === "dcs";
}

/** Where a signed-in user lands for their active role. */
export const homePathForRole = (role: string | null | undefined): string => {
  if (role === "superadmin") return "/platform";
  const cfg = getRoleConfig(role);
  return cfg ? cfg.defaultPath : "/dashboard";
};
