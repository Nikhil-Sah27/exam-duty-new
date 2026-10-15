import type { TeacherRole, UserRole } from "@/lib/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: "Superadmin",
  cs: "CS",
  dcs: "DCS",
  rs: "RS",
  invigilator: "Invigilator",
};

export const isTeacherRole = (role: UserRole | null | undefined): role is TeacherRole =>
  role === "invigilator" || role === "rs" || role === "dcs";
