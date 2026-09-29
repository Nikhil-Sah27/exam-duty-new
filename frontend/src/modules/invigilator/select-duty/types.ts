/**
 * The slot shape used by Select Duty is the same `AvailableDutySlot` produced
 * by the shared selectors layer. We re-export it as `DutySlot` so this module's
 * code reads naturally without leaking the shared name everywhere, while
 * keeping a single source of truth for the shape.
 */
export type { AvailableDutySlot as DutySlot } from "@/modules/shared/exams/selectors/examSelectors";

export type SlotState = "AVAILABLE" | "FULL" | "SELECTED" | "CONFLICT";

// Filter shape + empty value moved to the shared duties module so the RS/DCS
// select pages and the shared DutyFilterBar don't reach into this module.
export type { DutyFilters } from "@/modules/shared/duties/types";
export { EMPTY_FILTERS } from "@/modules/shared/duties/types";

export interface SelectionValidation {
  ok: boolean;
  reason?: string;
}
