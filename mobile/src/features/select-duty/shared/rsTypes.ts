// Copied verbatim from frontend/src/modules/rs/select-duty/types.ts — keep in sync; never re-derive this logic ad hoc.
// Only import paths were changed for the mobile tree.

import type { AvailableDutySlot } from "./examSelectors";

/**
 * Selection inside the RS Select Duty page is by **room group**, not by a
 * single room. A group is derived (not persisted) from a chunked partition
 * of available slots filtered by `flagKey = "rsAssigned"`. See
 * rsDutyGroupingUtils for the algorithm.
 */

export type RSGroupState =
  | "AVAILABLE" // every room in the chunk is open for RS
  | "SELECTED" // user has this groupId in their selection
  | "FULL" // every room in the chunk already has an RS assigned
  | "CONFLICT"; // time clashes with another selected group / persisted duty

/**
 * The grouping algorithm consumes `AvailableDutySlot` rows directly — the
 * shared selector now carries `buildingId`, which is the only piece RS
 * grouping needs beyond what invigilator's single-slot flow already uses.
 */
export type RSGroupingSourceItem = AvailableDutySlot;

export interface RSDutyGroup {
  /** Deterministic id: `${scheduleId}:${buildingId}:${chunkIndex}` */
  groupId: string;
  scheduleId: string;
  examGroupId: string;
  examType: AvailableDutySlot["examType"];
  semester: number;
  date: string;
  startTime: string;
  endTime: string;
  buildingId: string;
  buildingName: string;
  chunkIndex: number;
  /** The room+schedule rows that make up the group (size 1–5). */
  rooms: AvailableDutySlot[];
  /** Union of department codes across the group's rooms. */
  departments: string[];
  /** "Rooms 101–107" — first to last room number in numeric order. */
  rangeLabel: string;
  /** True when every room.flags.rsAssigned is true (cannot take more RS). */
  allAssigned: boolean;
}

export interface RSDutyFilters {
  date: string;
  examType: string;
  department: string;
  semester: string;
}

export const EMPTY_RS_FILTERS: RSDutyFilters = {
  date: "",
  examType: "",
  department: "",
  semester: "",
};

export interface RSSelectionValidation {
  ok: boolean;
  reason?: string;
}
