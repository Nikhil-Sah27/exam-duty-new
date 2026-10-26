import { isDutySelectable } from "./dutyStatusFilter";
import { getDutyStatus } from "./dutyStatusUtils";
import { sortExamsByPriority } from "./examSortUtils";
import { getExamGroupStatus } from "./examStatusUtils";
import type {
  DutyStatus,
  DutyStatusMap,
  ExamGroup,
  ExamGroupDetails,
  ExamRoomAssignment,
  ExamSchedule,
  RoomDutyFlags,
} from "./examTypes";

// Port of frontend/src/modules/shared/exams/selectors/dashboardSelectors.ts —
// the CS dashboard's assignment-status target + Ongoing / Upcoming lists. Keep
// the two identical, so the CS app shows the web dashboard's numbers. The
// web-only drill-down (`getClassesForTarget`) and Completed list are omitted.
//
// Assignment-status target is chosen by DATE: tomorrow when exams exist
// tomorrow, else the nearest future exam date; every classroom of every exam on
// that date is combined.

/** One classroom on one schedule, with its duty flags + status. */
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
  /** Classrooms with every duty filled. */
  fullyAssigned: number;
  /** Total classrooms considered on the target date. */
  totalClasses: number;
}

/** Class rows for one exam group from its details + duty status (selectable schedules, non-empty rooms). */
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
    if (!isDutySelectable({ date: schedule.date, startTime: schedule.startTime, endTime: schedule.endTime })) continue;
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

/** The nearest exam date at/after tomorrow, or null when no future exams. */
export function getNextUpcomingExamDate(rows: ClassAssignmentRow[], now: Date = new Date()): Date | null {
  const tomorrowMs = getTomorrow(now).getTime();
  let best: number | null = null;
  for (const r of rows) {
    const ms = dayMsOf(r.date);
    if (ms >= tomorrowMs && (best === null || ms < best)) best = ms;
  }
  return best === null ? null : new Date(best);
}

/** Distinct exams (group + type + semester) occurring on a given day. */
export function getExamsForDate(rows: ClassAssignmentRow[], dayMs: number): AssignmentTargetExam[] {
  const byGroup = new Map<string, AssignmentTargetExam>();
  for (const r of rows) {
    if (dayMsOf(r.date) !== dayMs) continue;
    if (!byGroup.has(r.examGroupId)) {
      byGroup.set(r.examGroupId, { examGroupId: r.examGroupId, examType: r.examType, semester: r.semester });
    }
  }
  return [...byGroup.values()];
}

/** The target date (tomorrow-first, else nearest future) and its combined classroom status. */
export function getDashboardAssignmentTarget(rows: ClassAssignmentRow[], now: Date = new Date()): DashboardAssignmentTarget {
  const date = getNextUpcomingExamDate(rows, now);
  if (!date) {
    return { date: null, isTomorrow: false, exams: [], notAssigned: 0, partiallyAssigned: 0, fullyAssigned: 0, totalClasses: 0 };
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

/** Exams in progress right now, nearest-first. */
export function getOngoingExams(groups: ExamGroup[]): ExamGroup[] {
  return sortExamsByPriority(groups.filter((g) => getExamGroupStatus(g) === "ongoing"));
}

/** Exams that haven't started yet, nearest-first. */
export function getUpcomingExams(groups: ExamGroup[]): ExamGroup[] {
  return sortExamsByPriority(groups.filter((g) => getExamGroupStatus(g) === "upcoming"));
}
