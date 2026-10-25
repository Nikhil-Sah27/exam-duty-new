import type { TeacherDutyProgress } from "../types";

/**
 * The words both apps put under a teacher's duty progress. Mobile carries an
 * identical copy (mobile/src/features/duties/progressCopy.ts) — change both
 * together, so the same numbers always read the same way.
 *
 * Every number comes from the backend progress endpoint (target, completed,
 * remaining = target − completed, assigned, toSelect = target − assigned,
 * reached = assigned ≥ target); nothing is computed here.
 */
export type DutyUnit = "duties" | "groups";

export const dutyUnitFor = (role: TeacherDutyProgress["role"]): DutyUnit =>
  role === "rs" || role === "dcs" ? "groups" : "duties";

/** "✓ All 5 duties selected" / "Selected 3 of 5 — select 2 more". */
export function selectionStatus(
  progress: Pick<TeacherDutyProgress, "target" | "assigned" | "toSelect" | "reached">,
  unit: DutyUnit,
): string {
  const { target, assigned, toSelect, reached } = progress;
  if (reached) return `✓ All ${target} ${unit} selected`;
  return `Selected ${assigned} of ${target} — select ${toSelect} more`;
}
