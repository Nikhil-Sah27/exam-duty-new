import type { UserRole } from "@/shared/lib/types";

export const ROLES: UserRole[] = ["cs", "dcs", "rs", "invigilator"];

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: "Superadmin",
  cs: "CS",
  dcs: "DCS",
  rs: "RS",
  invigilator: "Invigilator",
};

export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  superadmin: "bg-slate-800 text-white",
  cs: "bg-purple-100 text-purple-700",
  dcs: "bg-blue-100 text-blue-700",
  rs: "bg-amber-100 text-amber-700",
  invigilator: "bg-emerald-100 text-emerald-700",
};

export const ROLE_BADGE_COLORS_LIGHT: Record<UserRole, string> = {
  superadmin: "bg-white/20 text-white",
  cs: "bg-white/20 text-white",
  dcs: "bg-white/20 text-white",
  rs: "bg-white/20 text-white",
  invigilator: "bg-white/20 text-white",
};

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] || role;
}
