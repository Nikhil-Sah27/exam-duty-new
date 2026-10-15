// Copied verbatim from frontend/src/modules/duties/services/dcsGroupingService.ts
// (the pure normalizers only — fetching lives in ../api.ts) — keep in sync. The DCS
// grouping itself is computed server-side and persisted; never recompute it here.

import type { DcsGroup } from "./dcsTypes";

export type DcsDutyGroup = DcsGroup;

/**
 * Normalize a list of DCS groups for UI consumption: sort by schedule date,
 * then by start time, then by groupIndex so the earliest-occurring group
 * always surfaces first. Pure — does not fetch.
 */
export const buildDcsGroups = (groups: DcsDutyGroup[]): DcsDutyGroup[] => {
  return [...groups].sort((a, b) => {
    const da = new Date(a.schedule.date).getTime();
    const db = new Date(b.schedule.date).getTime();
    if (da !== db) return da - db;
    const t = a.schedule.startTime.localeCompare(b.schedule.startTime);
    if (t !== 0) return t;
    return a.groupIndex - b.groupIndex;
  });
};

/**
 * Backend `groupIndex` resets to 1 per schedule — useful for "this is group
 * 2 of 3 for Monday's exam", confusing when the same number appears on every
 * schedule's card. For display purposes we assign a stable cross-schedule
 * ordinal: 1, 2, 3 … in chronological order across every group in the input
 * list. The map is keyed by `_id` so consumers don't have to track index
 * positions across re-renders or filters.
 *
 * Pure — does not change the underlying `groupIndex` field. The backend
 * grouping algorithm is unchanged.
 */
export const buildDcsGroupOrdinalMap = (
  groups: readonly DcsDutyGroup[],
): Map<string, number> => {
  const sorted = buildDcsGroups([...groups]);
  const out = new Map<string, number>();
  sorted.forEach((g, i) => out.set(g._id, i + 1));
  return out;
};
