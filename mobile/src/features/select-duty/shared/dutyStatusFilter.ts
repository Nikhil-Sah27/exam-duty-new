// Copied verbatim from frontend/src/modules/duties/utils/dutyStatusFilter.ts — keep in sync; never re-derive this logic ad hoc.
// Only import paths were changed for the mobile tree.

/**
 * Single source of truth for "is this duty/slot still selectable?". Consumed
 * by the Invigilator, RS, and DCS Select Duty flows (and any future teacher
 * role that lands the same shape). The actual API surface exists in three
 * sibling files per the cross-role spec, but they all delegate here:
 *
 *   utils/dutyStatusFilter.ts          (this file — pure logic)
 *   hooks/useSelectableDuties.ts       (memoised React wrapper)
 *   services/dutyEligibilityService.ts (named-import compatibility)
 *
 * Lifecycle semantics:
 *   Upcoming   — schedule day is in the future, OR same day and startTime
 *                hasn't passed yet
 *   Ongoing    — same day, current time falls inside startTime..endTime
 *   Completed  — schedule day is in the past, OR same day and endTime has
 *                already passed
 *   Cancelled  — the source domain marked the slot dead (DCS `released`,
 *                ExamGroup `isActive: false`, …)
 *   Expired    — currently aliased to Completed. Reserved for the case where
 *                a future status enum carries an explicit "expired" state.
 *
 * Only Upcoming + Ongoing are selectable.
 */

export type DutyLifecycleStatus =
  | "Upcoming"
  | "Ongoing"
  | "Completed"
  | "Cancelled"
  | "Expired";

/**
 * Minimal time-ref the lifecycle math needs. Roles plug their own shape into
 * the generic `selectableFilter` by providing a `getTemporalRef` adapter.
 */
export interface DutyTemporalRef {
  /** ISO date string (YYYY-MM-DD or full ISO). */
  date: string;
  /** HH:MM. */
  startTime: string;
  /** HH:MM. */
  endTime: string;
  /**
   * Optional explicit cancellation marker. When true, status is forced to
   * "Cancelled" regardless of dates. (DCS `status === "released"`, exam group
   * `isActive: false`, …)
   */
  cancelled?: boolean;
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export function getDutyLifecycleStatus(
  ref: DutyTemporalRef,
  now: Date = new Date(),
): DutyLifecycleStatus {
  if (ref.cancelled) return "Cancelled";

  const today = startOfDay(now);
  const day = startOfDay(new Date(ref.date));

  if (day < today) return "Completed";
  if (day > today) return "Upcoming";

  // Same day → time comparison.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = toMin(ref.startTime);
  const endMin = toMin(ref.endTime);

  if (nowMin < startMin) return "Upcoming";
  if (nowMin >= endMin) return "Completed";
  return "Ongoing";
}

/** True iff the duty/slot is in a selectable state (Upcoming or Ongoing). */
export function isDutySelectable(ref: DutyTemporalRef, now?: Date): boolean {
  const s = getDutyLifecycleStatus(ref, now);
  return s === "Upcoming" || s === "Ongoing";
}

/** Filter a list of duty refs down to the selectable ones. */
export function getSelectableDuties<T extends DutyTemporalRef>(
  duties: readonly T[],
  now?: Date,
): T[] {
  return duties.filter((d) => isDutySelectable(d, now));
}

/** Convenience: drop only the Completed/Expired buckets (keeps Cancelled). */
export function excludeCompletedDuties<T extends DutyTemporalRef>(
  duties: readonly T[],
  now?: Date,
): T[] {
  return duties.filter((d) => {
    const s = getDutyLifecycleStatus(d, now);
    return s !== "Completed" && s !== "Expired";
  });
}

/**
 * Generic adapter-driven filter for items whose temporal ref is nested.
 * Lets DCS groups, RS room batches, and per-room Invigilator slots all
 * share this function without exposing their internal shapes.
 *
 *   selectableFilter(groups, (g) => ({
 *     date: g.schedule.date,
 *     startTime: g.schedule.startTime,
 *     endTime: g.schedule.endTime,
 *     cancelled: g.status === "released",
 *   }))
 */
export function selectableFilter<T>(
  items: readonly T[],
  getTemporalRef: (item: T) => DutyTemporalRef,
  now?: Date,
): T[] {
  return items.filter((item) => isDutySelectable(getTemporalRef(item), now));
}
