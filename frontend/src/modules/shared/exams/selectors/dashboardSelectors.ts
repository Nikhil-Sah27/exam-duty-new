/**
 * Centralized, pure selectors that power the CS dashboard summary widgets
 * (assignment status target, Ongoing / Upcoming / Completed exams).
 *
 * SINGLE SOURCE OF TRUTH: these reuse the existing canonical helpers rather
 * than re-deriving anything:
 *   • per-room duty status  → `getDutyStatus` (shared dutyStatusUtils)
 *   • per-group lifecycle    → `getExamGroupStatus` (shared examStatusUtils)
 *   • status/date ordering   → `sortExamsByPriority` (shared examSortUtils)
 * The duty slots they consume come from `useAvailableDutySlots`, the exact
 * same feed Select Duty uses for DCS / RS / Invigilator — so dashboard counts
 * always match what those roles see.
 *
 * The assignment-status target is chosen by DATE, not by a single exam:
 *   1. If any exam is scheduled tomorrow → target date = tomorrow.
 *   2. Otherwise → target date = the nearest future exam date after tomorrow.
 *   3. All exams (and all their classrooms) on the target date are combined.
 */
import type { ExamGroup } from "../types/exam.types";
import type { AvailableDutySlot } from "./examSelectors";
import { getExamGroupStatus } from "../utils/examStatusUtils";
import { getDutyStatus } from "../utils/dutyStatusUtils";
import { sortExamsByPriority } from "../utils/examSortUtils";

export interface AssignmentTargetExam {
  examGroupId: string;
  examType: ExamGroup["examType"];
  semester: number;
}

export interface DashboardAssignmentTarget {
  /** Start-of-day of the selected date, or null when no future exams exist. */
  date: Date | null;
  /** `YYYY-MM-DD` for deep-links, or null. */
  dateKey: string | null;
  /** True when the selected date is tomorrow. */
  isTomorrow: boolean;
  /** Distinct exams occurring on the target date. */
  exams: AssignmentTargetExam[];
  /** Classrooms with every required duty vacant. */
  notAssigned: number;
  /** Classrooms with some duties filled but ≥1 still vacant. */
  partiallyAssigned: number;
  /** Classrooms fully assigned (computed, not displayed). */
  fullyAssigned: number;
  /** Total classrooms considered on the target date. */
  totalClasses: number;
}

/** Start-of-day for the next calendar day relative to `now`. */
export function getTomorrow(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Start-of-day epoch ms for an ISO date string. */
function dayMsOf(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Format a Date as a local `YYYY-MM-DD` key (used in deep-link URLs). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a local `YYYY-MM-DD` key back to a start-of-day epoch ms. */
export function dayMsFromKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

/** Slots scheduled on a specific day (by start-of-day ms). */
function slotsOnDate(slots: AvailableDutySlot[], dayMs: number): AvailableDutySlot[] {
  return slots.filter((s) => dayMsOf(s.date) === dayMs);
}

/**
 * The nearest exam date at/after tomorrow. Returns tomorrow when exams exist
 * tomorrow, else the closest future date, else null when no future exams.
 */
export function getNextUpcomingExamDate(
  slots: AvailableDutySlot[],
  now: Date = new Date(),
): Date | null {
  const tomorrowMs = getTomorrow(now).getTime();
  let best: number | null = null;
  for (const s of slots) {
    const ms = dayMsOf(s.date);
    if (ms >= tomorrowMs && (best === null || ms < best)) best = ms;
  }
  return best === null ? null : new Date(best);
}

/** Distinct exams (group + type + semester) occurring on a given day. */
export function getExamsForDate(
  slots: AvailableDutySlot[],
  dayMs: number,
): AssignmentTargetExam[] {
  const byGroup = new Map<string, AssignmentTargetExam>();
  for (const s of slotsOnDate(slots, dayMs)) {
    if (!byGroup.has(s.examGroupId)) {
      byGroup.set(s.examGroupId, {
        examGroupId: s.examGroupId,
        examType: s.examType,
        semester: s.semester,
      });
    }
  }
  return [...byGroup.values()];
}

/** Aggregate a set of slots (classrooms) into Not/Partial/Fully counts. */
export function getAssignmentStatusForSlots(slots: AvailableDutySlot[]) {
  let notAssigned = 0;
  let partiallyAssigned = 0;
  let fullyAssigned = 0;
  for (const s of slots) {
    const status = getDutyStatus(s.flags);
    if (status === "NOT_ASSIGNED") notAssigned++;
    else if (status === "PARTIAL") partiallyAssigned++;
    else fullyAssigned++;
  }
  return {
    notAssigned,
    partiallyAssigned,
    fullyAssigned,
    totalClasses: slots.length,
  };
}

/**
 * The composite the dashboard consumes: picks the target date (tomorrow-first,
 * else nearest future date) and combines the assignment status across every
 * classroom of every exam on that date.
 */
export function getDashboardAssignmentTarget(
  slots: AvailableDutySlot[],
  now: Date = new Date(),
): DashboardAssignmentTarget {
  const date = getNextUpcomingExamDate(slots, now);
  if (!date) {
    return {
      date: null,
      dateKey: null,
      isTomorrow: false,
      exams: [],
      notAssigned: 0,
      partiallyAssigned: 0,
      fullyAssigned: 0,
      totalClasses: 0,
    };
  }
  const dayMs = date.getTime();
  const counts = getAssignmentStatusForSlots(slotsOnDate(slots, dayMs));
  return {
    date,
    dateKey: toDateKey(date),
    isTomorrow: dayMs === getTomorrow(now).getTime(),
    exams: getExamsForDate(slots, dayMs),
    ...counts,
  };
}

/**
 * Exam-group ids that own ≥1 classroom in the given status on a specific day.
 * Used by the Exams page to filter the list when a status card deep-links in.
 */
export function getGroupIdsWithStatusOnDate(
  slots: AvailableDutySlot[],
  status: "NOT_ASSIGNED" | "PARTIAL",
  dayMs: number,
): Set<string> {
  const ids = new Set<string>();
  for (const s of slotsOnDate(slots, dayMs)) {
    if (getDutyStatus(s.flags) === status) ids.add(s.examGroupId);
  }
  return ids;
}

/** Exams in progress right now, nearest-first. */
export function getOngoingExams(groups: ExamGroup[]): ExamGroup[] {
  return sortExamsByPriority(
    groups.filter((g) => getExamGroupStatus(g) === "ongoing"),
  );
}

/** Exams that haven't started yet, nearest-first. */
export function getUpcomingExams(groups: ExamGroup[]): ExamGroup[] {
  return sortExamsByPriority(
    groups.filter((g) => getExamGroupStatus(g) === "upcoming"),
  );
}

/** Exams that have finished, most-recently-completed first. */
export function getCompletedExams(groups: ExamGroup[]): ExamGroup[] {
  return sortExamsByPriority(
    groups.filter((g) => getExamGroupStatus(g) === "completed"),
  );
}
