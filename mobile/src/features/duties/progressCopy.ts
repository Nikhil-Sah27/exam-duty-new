import type { DutyProgress } from "@/features/select-duty/api";

/**
 * The words both apps put under a teacher's duty progress. Port of
 * frontend/src/modules/duty-calculation/utils/progressCopy.ts — keep the two
 * identical, so the same numbers always read the same way on web and phone.
 *
 * Every number comes from the backend progress endpoint (target, completed,
 * remaining = target − completed, assigned, toSelect = target − assigned,
 * reached = assigned ≥ target); nothing is computed here.
 */
export type DutyUnit = "duties" | "groups";

export const dutyUnitFor = (role: DutyProgress["role"]): DutyUnit =>
  role === "rs" || role === "dcs" ? "groups" : "duties";

/** "✓ All 5 duties selected" / "Selected 3 of 5 — select 2 more". */
export function selectionStatus(
  progress: Pick<DutyProgress, "target" | "assigned" | "toSelect" | "reached">,
  unit: DutyUnit,
): string {
  const { target, assigned, toSelect, reached } = progress;
  if (reached) return `✓ All ${target} ${unit} selected`;
  return `Selected ${assigned} of ${target} — select ${toSelect} more`;
}
