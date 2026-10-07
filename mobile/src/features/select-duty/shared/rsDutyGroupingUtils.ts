// Copied verbatim from frontend/src/modules/rs/select-duty/utils/rsDutyGroupingUtils.ts — keep in sync; never re-derive this logic ad hoc.
// Only import paths were changed for the mobile tree.

import type { AvailableDutySlot } from "./examSelectors";
import type { RSDutyGroup, RSGroupingSourceItem } from "./rsTypes";

/**
 * Pure RS grouping algorithm. Single source of truth: every grouped view in
 * the RS flow runs slots through `groupRoomsIntoRSGroups`. No backend
 * persistence — groups are derived so `groups update dynamically if rooms
 * change` (per spec).
 *
 * Partition key: examGroup | schedule | date | startTime | endTime | building.
 * Inside each partition, sort numerically by roomNumber and chunk by `size`.
 */

const NUMERIC_PREFIX_RE = /^(\d+)/;

/**
 * Sort by leading-numeric portion of the room number, then by the full string
 * as a tiebreaker. Handles "101", "108A", "G-12" reasonably without trying
 * to be too clever — we only need stable ordering, not a perfect natural sort.
 */
export function compareRoomNumbers(a: string, b: string): number {
  const am = a.match(NUMERIC_PREFIX_RE);
  const bm = b.match(NUMERIC_PREFIX_RE);
  if (am && bm) {
    const an = Number(am[1]);
    const bn = Number(bm[1]);
    if (an !== bn) return an - bn;
  } else if (am) {
    return -1;
  } else if (bm) {
    return 1;
  }
  return a.localeCompare(b);
}

function partitionKey(item: RSGroupingSourceItem): string {
  return [
    item.examGroupId,
    item.scheduleId,
    item.date,
    item.startTime,
    item.endTime,
    item.buildingId,
  ].join("|");
}

function buildRangeLabel(rooms: AvailableDutySlot[]): string {
  if (rooms.length === 0) return "";
  if (rooms.length === 1) return `Room ${rooms[0].roomNumber}`;
  const first = rooms[0].roomNumber;
  const last = rooms[rooms.length - 1].roomNumber;
  return `Rooms ${first}–${last}`;
}

function unionDepartments(rooms: AvailableDutySlot[]): string[] {
  const set = new Set<string>();
  for (const r of rooms) {
    for (const d of r.departments) set.add(d.toUpperCase());
  }
  return [...set].sort();
}

/**
 * Group RS-eligible room slots into RS duty groups.
 *
 * @param items   Source rows. Caller decides what to feed (e.g. all available
 *                slots, or only those without `rsAssigned`); grouping doesn't
 *                filter — it preserves whatever's passed, including assigned
 *                rooms, so the UI can show FULL groups truthfully.
 * @param size    Chunk size. Spec: 5.
 */
export function groupRoomsIntoRSGroups(
  items: readonly RSGroupingSourceItem[],
  size = 5,
): RSDutyGroup[] {
  if (size < 1) throw new Error("group size must be >= 1");

  const partitions = new Map<string, RSGroupingSourceItem[]>();
  for (const item of items) {
    const key = partitionKey(item);
    const bucket = partitions.get(key);
    if (bucket) bucket.push(item);
    else partitions.set(key, [item]);
  }

  const groups: RSDutyGroup[] = [];
  for (const bucket of partitions.values()) {
    bucket.sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
    for (let i = 0; i < bucket.length; i += size) {
      const chunk = bucket.slice(i, i + size);
      const first = chunk[0];
      const chunkIndex = Math.floor(i / size);
      groups.push({
        groupId: `${first.scheduleId}:${first.buildingId}:${chunkIndex}`,
        scheduleId: first.scheduleId,
        examGroupId: first.examGroupId,
        examType: first.examType,
        semester: first.semester,
        date: first.date,
        startTime: first.startTime,
        endTime: first.endTime,
        buildingId: first.buildingId,
        buildingName: first.buildingName,
        chunkIndex,
        rooms: chunk,
        departments: unionDepartments(chunk),
        rangeLabel: buildRangeLabel(chunk),
        allAssigned: chunk.every((r) => r.flags.rsAssigned),
      });
    }
  }

  // Stable presentation order: by date → start time → building name → chunk.
  groups.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    if (a.buildingName !== b.buildingName) {
      return a.buildingName.localeCompare(b.buildingName);
    }
    return a.chunkIndex - b.chunkIndex;
  });

  return groups;
}

/** Total room count across a list of groups (used by the selection panel). */
export function totalRoomCount(groups: readonly RSDutyGroup[]): number {
  return groups.reduce((sum, g) => sum + g.rooms.length, 0);
}

export interface RSDutyDateTimeSection {
  /** Stable id — `${date}|${startTime}|${endTime}`. */
  sectionId: string;
  date: string;
  startTime: string;
  endTime: string;
  /** All groups that share this date + time window, in the original order. */
  groups: RSDutyGroup[];
}

/**
 * Partition RS duty groups into date+time sections so the UI can render a
 * heading (date + start–end time) followed by the groups that fall inside it.
 * Input order is preserved inside each section, and sections themselves are
 * sorted by date → startTime → endTime to match the flat sort in
 * `groupRoomsIntoRSGroups`.
 *
 * Pure — safe to call inside a memo hook. Empty input returns an empty array.
 */
export function sectionizeRSGroupsByDateTime(
  groups: readonly RSDutyGroup[],
): RSDutyDateTimeSection[] {
  if (groups.length === 0) return [];

  const buckets = new Map<string, RSDutyDateTimeSection>();
  for (const g of groups) {
    const sectionId = `${g.date}|${g.startTime}|${g.endTime}`;
    const existing = buckets.get(sectionId);
    if (existing) {
      existing.groups.push(g);
    } else {
      buckets.set(sectionId, {
        sectionId,
        date: g.date,
        startTime: g.startTime,
        endTime: g.endTime,
        groups: [g],
      });
    }
  }

  return [...buckets.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return a.endTime < b.endTime ? -1 : a.endTime > b.endTime ? 1 : 0;
  });
}
