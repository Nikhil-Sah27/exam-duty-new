// Copied verbatim from frontend/src/modules/shared/duties/utils/timeConflictUtils.ts — keep in sync; never re-derive this logic ad hoc.
// Only import paths were changed for the mobile tree.

import type { Duty } from "./examTypes";
import type { AvailableDutySlot } from "./examSelectors";

/**
 * Time/conflict primitives shared by every role's Select Duty flow
 * (Invigilator selects single rooms; RS selects groups of rooms — both need
 * the same "does this time clash with what I already picked?" engine).
 */

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return da.getTime() === db.getTime();
}

export function overlaps(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return (
    toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA)
  );
}

export interface TimeWindow {
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * Find the first booking (selected slot or persisted duty) that overlaps with
 * `candidate` on the same calendar day. Returns null if free.
 *
 * Generic over `S` (a selected-thing carrying date/start/end) so RS groups and
 * single invigilator slots can both use it.
 */
export function findTimeConflict<S extends TimeWindow & { id: string }>(
  candidate: TimeWindow & { id: string },
  selected: readonly S[],
  myDuties: readonly Duty[],
): S | Duty | null {
  for (const s of selected) {
    if (s.id === candidate.id) continue;
    if (!sameDay(s.date, candidate.date)) continue;
    if (overlaps(s.startTime, s.endTime, candidate.startTime, candidate.endTime)) {
      return s;
    }
  }
  for (const d of myDuties) {
    if (d.status !== "assigned") continue;
    if (!sameDay(d.date, candidate.date)) continue;
    if (overlaps(d.startTime, d.endTime, candidate.startTime, candidate.endTime)) {
      return d;
    }
  }
  return null;
}

/** Format a found conflict into a user-facing reason string. */
export function describeConflict(c: AvailableDutySlot | Duty | TimeWindow): string {
  if ("roomNumber" in c) {
    return `${c.roomNumber} (${c.startTime}–${c.endTime})`;
  }
  if ("room" in c && typeof c.room === "string") {
    return `${c.room} (${c.startTime}–${c.endTime})`;
  }
  return `${c.startTime}–${c.endTime}`;
}
