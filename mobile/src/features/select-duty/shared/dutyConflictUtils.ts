// Copied verbatim from frontend/src/modules/duties/utils/dutyConflictUtils.ts — keep in sync; never re-derive this logic ad hoc.
// Only import paths were changed for the mobile tree.

import type { Duty } from "./examTypes";
import {
  findTimeConflict as sharedFindTimeConflict,
  describeConflict as sharedDescribeConflict,
  overlaps as sharedOverlaps,
  sameDay as sharedSameDay,
  type TimeWindow,
} from "./timeConflictUtils";

/**
 * Cross-role conflict primitives used by every Select Duty surface
 * (Invigilator, RS, DCS). Wraps the lower-level `timeConflictUtils` so
 * callers reading `modules/duties/utils/dutyConflictUtils` get the friendly
 * API surface specified by the UX brief:
 *
 *   isTimeConflict()       — predicate
 *   getConflictingDuties() — list of clashes for a candidate
 *   getConflictReason()    — copy-ready string for tooltips / banners
 *
 * Selection workflow, conflict detection logic, and the underlying
 * date/time math remain in `timeConflictUtils` — this file only re-shapes
 * what's already there.
 */

export type ConflictItem = ConflictWindow | Duty;

/**
 * Minimum data shape needed to be a "candidate" or a "blocker". Any
 * Select Duty card already carries date + start/end, so the call sites
 * only need a thin adapter, never a duplicated conflict engine.
 */
export interface ConflictWindow extends TimeWindow {
  id: string;
  /** Optional human label, surfaced by getConflictReason for context. */
  roomNumber?: string;
}

/**
 * True if `candidate` overlaps with any selected window or persisted duty
 * on the same calendar day. Used by `stateOf` to flag a card as
 * `CONFLICT` before render — so the card paints disabled instead of
 * inviting a click that will fail.
 */
export function isTimeConflict(
  candidate: ConflictWindow,
  blockers: {
    selected?: readonly ConflictWindow[];
    myDuties?: readonly Duty[];
  } = {},
): boolean {
  return getConflictingDuties(candidate, blockers).length > 0;
}

/**
 * Return every conflicting item (selected windows + assigned duties) so
 * the UI can show "2 conflicts hidden" or list specific names in tooltips.
 * Order: selected first, then persisted duties — most recent intent
 * surfaces above historical commitments.
 */
export function getConflictingDuties(
  candidate: ConflictWindow,
  blockers: {
    selected?: readonly ConflictWindow[];
    myDuties?: readonly Duty[];
  } = {},
): ConflictItem[] {
  const selected = blockers.selected ?? [];
  const myDuties = blockers.myDuties ?? [];

  const out: ConflictItem[] = [];

  for (const s of selected) {
    if (s.id === candidate.id) continue;
    if (!sharedSameDay(s.date, candidate.date)) continue;
    if (
      sharedOverlaps(
        s.startTime,
        s.endTime,
        candidate.startTime,
        candidate.endTime,
      )
    ) {
      out.push(s);
    }
  }
  for (const d of myDuties) {
    if (d.status !== "assigned") continue;
    if (!sharedSameDay(d.date, candidate.date)) continue;
    if (
      sharedOverlaps(
        d.startTime,
        d.endTime,
        candidate.startTime,
        candidate.endTime,
      )
    ) {
      out.push(d);
    }
  }
  return out;
}

/**
 * Build the user-facing reason string for a conflicting candidate. Picks
 * the first conflict (the most relevant — usually a freshly-selected
 * item) and turns it into the brief room+time label `describeConflict`
 * already produces.
 */
export function getConflictReason(
  candidate: ConflictWindow,
  blockers: {
    selected?: readonly ConflictWindow[];
    myDuties?: readonly Duty[];
  } = {},
): string | null {
  const conflicts = getConflictingDuties(candidate, blockers);
  if (conflicts.length === 0) return null;
  const first = conflicts[0];
  // Both ConflictWindow (has roomNumber when supplied) and Duty (has
  // room: string) hit the same describe shape used by the rest of the app.
  return `You already have a duty during this time slot (${sharedDescribeConflict(
    first as never,
  )}). Remove the conflicting selection first.`;
}

/**
 * Convenience re-export — saves callers an import from the lower layer
 * when they only need the shared engine name once.
 */
export { sharedFindTimeConflict as findTimeConflict };

/**
 * Teacher ids that already hold an ASSIGNED duty overlapping `window`.
 * Uses the same shared same-day + overlap primitives as the rest of the app,
 * applied across the whole duty list — so the CS eligible-teacher picker can
 * hide teachers the backend conflict scan would reject up front.
 */
export function getBusyTeacherIds(
  duties: readonly Duty[],
  window: TimeWindow,
): Set<string> {
  const busy = new Set<string>();
  for (const d of duties) {
    if (d.status !== "assigned") continue;
    if (!sharedSameDay(d.date, window.date)) continue;
    if (
      !sharedOverlaps(d.startTime, d.endTime, window.startTime, window.endTime)
    ) {
      continue;
    }
    if (d.teacher?._id) busy.add(d.teacher._id);
  }
  return busy;
}
