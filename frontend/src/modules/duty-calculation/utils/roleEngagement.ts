import type { TeacherDutyProgress } from "../types";

/** Display label for each duty role, shared by the table and the pie chart. */
export const ROLE_LABEL: Record<TeacherDutyProgress["role"], string> = {
  invigilator: "Invigilator",
  rs: "RS",
  dcs: "DCS",
  cs: "CS",
};

export interface RoleEngagement {
  role: TeacherDutyProgress["role"];
  completed: number;
  target: number;
  /** completed ÷ target as a 0–100 percentage (0 when there is no target). */
  percentage: number;
}

// Present roles in a stable order regardless of who happens to be in the cohort.
const ROLE_SEQUENCE: TeacherDutyProgress["role"][] = ["invigilator", "rs", "dcs"];

/**
 * Aggregate the cohort's per-role rows into one engagement entry per role:
 * total completed vs total target, and the resulting completion percentage —
 * i.e. how effectively each role's duty load is being met. Pure; drives the
 * role-engagement pie.
 */
export function computeRoleEngagement(
  teachers: TeacherDutyProgress[],
): RoleEngagement[] {
  const acc = new Map<string, { completed: number; target: number }>();
  for (const t of teachers) {
    const cur = acc.get(t.role) ?? { completed: 0, target: 0 };
    cur.completed += t.completed;
    cur.target += t.target;
    acc.set(t.role, cur);
  }
  return ROLE_SEQUENCE.filter((r) => acc.has(r)).map((role) => {
    const { completed, target } = acc.get(role)!;
    return {
      role,
      completed,
      target,
      percentage: target > 0 ? Math.round((completed / target) * 100) : 0,
    };
  });
}
