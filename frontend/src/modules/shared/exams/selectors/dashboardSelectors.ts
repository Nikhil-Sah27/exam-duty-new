/**
 * Centralized, pure selectors that power the CS dashboard assignment widgets
 * (assignment-status target + the class-level drill-down) and the Ongoing /
 * Upcoming / Completed exam lists.
 *
 * SINGLE SOURCE OF TRUTH: everything is derived from `ClassAssignmentRow[]` —
 * one row per (schedule × classroom) built with the SAME rules the rest of the
 * app uses:
 *   • per-room duty status  → `getDutyStatus` (shared dutyStatusUtils)
 *   • schedule selectability → `isDutySelectable` (duties/dutyStatusFilter)
 *   • per-group lifecycle    → `getExamGroupStatus` (shared examStatusUtils)
 *   • status/date ordering   → `sortExamsByPriority` (shared examSortUtils)
 * The rows are fetched by `useAssignmentClassRows`, which reads the exact same
 * `/exam-groups/:id/details` + `/duty-status` feed Select Duty uses — so the
 * dashboard card COUNT and the drill-down LIST always match.
 *
 * Assignment-status target is chosen by DATE, not by a single exam:
 *   1. If any exam is scheduled tomorrow → target date = tomorrow.
 *   2. Otherwise → target date = the nearest future exam date after tomorrow.
 *   3. All exams (and all their classrooms) on the target date are combined.
 */
import type {
  ExamGroup,
  ExamGroupDetails,
  ExamSchedule,
  ExamRoomAssignment,
  RoomDutyFlags,
  DutyStatus,
  DutyStatusMap,
} from "../types/exam.types";
import { getExamGroupStatus } from "../utils/examStatusUtils";
import { getDutyStatus } from "../utils/dutyStatusUtils";
import { sortExamsByPriority } from "../utils/examSortUtils";
import { isDutySelectable } from "@/modules/duties/utils/dutyStatusFilter";

/**
 * One classroom on one schedule, with its duty flags + status and the raw
 * schedule/room objects needed to drive the existing DutyStatusModal.
 */
export interface ClassAssignmentRow {
  /** `${scheduleId}:${examRoomId}` — stable identity. */
  slotId: string;
  examGroupId: string;
  examType: ExamGroup["examType"];
  semester: number;
  date: string;
  startTime: string;
  endTime: string;
  departments: string[];
  flags: RoomDutyFlags;
  status: DutyStatus;
  /** Raw objects handed straight to the existing assignment modal. */
  schedule: ExamSchedule;
  assignment: ExamRoomAssignment;
}

export interface AssignmentTargetExam {
  examGroupId: string;
  examType: ExamGroup["examType"];
  semester: number;
}

export interface DashboardAssignmentTarget {
  /** Start-of-day of the selected date, or null when no future exams exist. */
  date: Date | null;
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

/**
 * Build the class rows for a single exam group from its details + duty status.
 * Mirrors `selectDutySlotsForGroup`'s filters (selectable schedules, non-empty
 * rooms) but keeps the raw schedule/room objects so the assignment modal can
 * be reused as-is. Reuses `getDutyStatus` — no duplicated status logic.
 */
export function buildClassRowsForGroup({
  group,
  details,
  dutyStatus,
}: {
  group: ExamGroup;
  details: ExamGroupDetails;
  dutyStatus: DutyStatusMap;
}): ClassAssignmentRow[] {
  const rows: ClassAssignmentRow[] = [];
  for (const schedule of details.schedules) {
    if (
      !isDutySelectable({
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      })
    ) {
      continue;
    }
    if (schedule.rooms.length === 0) continue;

    for (const assignment of schedule.rooms) {
      const flags: RoomDutyFlags = dutyStatus[assignment._id] || {
        dcsAssigned: false,
        rsAssigned: false,
        invigilatorAssigned: false,
      };
      rows.push({
        slotId: `${schedule._id}:${assignment._id}`,
        examGroupId: group._id,
        examType: group.examType,
        semester: group.semester,
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        departments: assignment.departments,
        flags,
        status: getDutyStatus(flags),
        schedule,
        assignment,
      });
    }
  }
  return rows;
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

/**
 * The nearest exam date at/after tomorrow. Returns tomorrow when exams exist
 * tomorrow, else the closest future date, else null when no future exams.
 */
export function getNextUpcomingExamDate(
  rows: ClassAssignmentRow[],
  now: Date = new Date(),
): Date | null {
  const tomorrowMs = getTomorrow(now).getTime();
  let best: number | null = null;
  for (const r of rows) {
    const ms = dayMsOf(r.date);
    if (ms >= tomorrowMs && (best === null || ms < best)) best = ms;
  }
  return best === null ? null : new Date(best);
}

/** Distinct exams (group + type + semester) occurring on a given day. */
export function getExamsForDate(
  rows: ClassAssignmentRow[],
  dayMs: number,
): AssignmentTargetExam[] {
  const byGroup = new Map<string, AssignmentTargetExam>();
  for (const r of rows) {
    if (dayMsOf(r.date) !== dayMs) continue;
    if (!byGroup.has(r.examGroupId)) {
      byGroup.set(r.examGroupId, {
        examGroupId: r.examGroupId,
        examType: r.examType,
        semester: r.semester,
      });
    }
  }
  return [...byGroup.values()];
}

/**
 * The composite the dashboard consumes: picks the target date (tomorrow-first,
 * else nearest future date) and combines the assignment status across every
 * classroom of every exam on that date.
 */
export function getDashboardAssignmentTarget(
  rows: ClassAssignmentRow[],
  now: Date = new Date(),
): DashboardAssignmentTarget {
  const date = getNextUpcomingExamDate(rows, now);
  if (!date) {
    return {
      date: null,
      isTomorrow: false,
      exams: [],
      notAssigned: 0,
      partiallyAssigned: 0,
      fullyAssigned: 0,
      totalClasses: 0,
    };
  }
  const dayMs = date.getTime();
  const dayRows = rows.filter((r) => dayMsOf(r.date) === dayMs);
  let notAssigned = 0;
  let partiallyAssigned = 0;
  let fullyAssigned = 0;
  for (const r of dayRows) {
    if (r.status === "NOT_ASSIGNED") notAssigned++;
    else if (r.status === "PARTIAL") partiallyAssigned++;
    else fullyAssigned++;
  }
  return {
    date,
    isTomorrow: dayMs === getTomorrow(now).getTime(),
    exams: getExamsForDate(rows, dayMs),
    notAssigned,
    partiallyAssigned,
    fullyAssigned,
    totalClasses: dayRows.length,
  };
}

/**
 * The drill-down list: classrooms on the target date matching the selected
 * status, ordered by session time then room. Uses the SAME rows as the counts
 * so the number on the card equals the number of rows shown.
 */
export function getClassesForTarget(
  rows: ClassAssignmentRow[],
  date: Date | null,
  statusFilter: Extract<DutyStatus, "NOT_ASSIGNED" | "PARTIAL">,
): ClassAssignmentRow[] {
  if (!date) return [];
  const dayMs = date.getTime();
  return rows
    .filter((r) => dayMsOf(r.date) === dayMs && r.status === statusFilter)
    .sort((a, b) => {
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      const roomA = `${a.assignment.room.building?.name ?? ""} ${a.assignment.room.roomNumber}`;
      const roomB = `${b.assignment.room.building?.name ?? ""} ${b.assignment.room.roomNumber}`;
      return roomA.localeCompare(roomB, undefined, { numeric: true });
    });
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
