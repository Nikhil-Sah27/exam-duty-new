import type { UserRole } from "@/lib/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  cs: "CS",
  dcs: "DCS",
  rs: "RS",
  invigilator: "Invigilator",
};

export const isTeacherRole = (role: UserRole | null | undefined): role is Exclude<UserRole, "cs"> =>
  role === "invigilator" || role === "rs" || role === "dcs";
