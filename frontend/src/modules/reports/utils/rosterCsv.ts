import type { DutyStatusMap, ExamSchedule } from "@/modules/exams/types";
import { formatDate } from "@/shared/lib/utils";
import { downloadCsv, excelText } from "@/shared/lib/csv";
import { departmentLabel, sortRooms } from "./rosterFormat";
import { groupSchedulesByDay } from "./groupSchedulesByDay";

/**
 * CSV export for the Duty Roster, at three scopes: the whole exam, a single
 * day, or a single shift. All three share one row builder and one column set,
 * so a room's line is byte-identical no matter which button produced it.
 */

export interface ExamMeta {
  examType: string;
  semester: number;
}

export const ROSTER_CSV_HEADERS = [
  "Date",
  "Time",
  "Building",
  "Room",
  "Exam",
  "Semester",
  "Department",
  "Invigilator",
  "Invigilator Phone",
  "RS",
  "RS Phone",
  "DCS",
  "DCS Phone",
] as const;

type Row = (string | null)[];

/**
 * One CSV row per room in a shift, in stable room order. Each row carries the
 * exam identity (type + semester) and the room's department(s) so a class line
 * states which department's exam is being held there — even when the file is
 * sliced down to a single shift.
 */
export function buildShiftRows(
  meta: ExamMeta,
  schedule: ExamSchedule,
  statusMap: DutyStatusMap,
): Row[] {
  return sortRooms(schedule.rooms).map((r) => {
    const flags = statusMap[r._id];
    return [
      excelText(formatDate(schedule.date)),
      excelText(`${schedule.startTime}–${schedule.endTime}`),
      r.room.building?.name ?? "",
      excelText(r.room.roomNumber),
      excelText(meta.examType),
      excelText(`Sem ${meta.semester}`),
      departmentLabel(r),
      flags?.invigilatorTeacher?.name ?? "VACANT",
      flags?.invigilatorTeacher?.phone ?? "",
      flags?.rsTeacher?.name ?? "VACANT",
      flags?.rsTeacher?.phone ?? "",
      flags?.dcsTeacher?.name ?? "VACANT",
      flags?.dcsTeacher?.phone ?? "",
    ];
  });
}

// ── Filename helpers ────────────────────────────────────────────────────────

/** Calendar-date portion of an ISO string, safe for filenames (`2026-08-27`). */
const isoDatePart = (dateStr: string): string => {
  const t = dateStr.indexOf("T");
  return t >= 0 ? dateStr.slice(0, t) : dateStr;
};

/** Strip anything that isn't filename-safe. */
const slug = (s: string) =>
  s.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");

const timePart = (t: string) => t.replace(/:/g, "");

const baseName = (meta: ExamMeta) =>
  `duty-roster-${slug(meta.examType)}-sem${meta.semester}`;

// ── Blank-row separators ─────────────────────────────────────────────────────
// Empty rows visually separate one shift/day block from the next in the file.

/** An empty CSV line (renders as a blank row in Excel/Sheets). */
const blankRow = (): Row => [];

/** Rows for a list of shifts, each shift block separated by one blank row. */
function shiftsWithGaps(
  meta: ExamMeta,
  shifts: ExamSchedule[],
  statusMap: DutyStatusMap,
): Row[] {
  const out: Row[] = [];
  shifts.forEach((s, i) => {
    if (i > 0) out.push(blankRow());
    out.push(...buildShiftRows(meta, s, statusMap));
  });
  return out;
}

// ── Export entry points ─────────────────────────────────────────────────────

/**
 * Every room across every schedule of the exam. Shifts are separated by a
 * single blank row and days by a double blank row, so the file mirrors the
 * day → shift structure of the on-screen roster.
 */
export function exportExamCsv(
  meta: ExamMeta,
  schedules: ExamSchedule[],
  statusMap: DutyStatusMap,
): void {
  const days = groupSchedulesByDay(schedules);
  const rows: Row[] = [];
  days.forEach((day, i) => {
    if (i > 0) rows.push(blankRow(), blankRow());
    rows.push(...shiftsWithGaps(meta, day.shifts, statusMap));
  });
  downloadCsv(`${baseName(meta)}.csv`, [...ROSTER_CSV_HEADERS], rows);
}

/** Every room across all shifts of one day — shifts separated by a blank row. */
export function exportDayCsv(
  meta: ExamMeta,
  date: string,
  shifts: ExamSchedule[],
  statusMap: DutyStatusMap,
): void {
  downloadCsv(
    `${baseName(meta)}-${isoDatePart(date)}.csv`,
    [...ROSTER_CSV_HEADERS],
    shiftsWithGaps(meta, shifts, statusMap),
  );
}

/** Every room in a single shift (date + time window). */
export function exportShiftCsv(
  meta: ExamMeta,
  schedule: ExamSchedule,
  statusMap: DutyStatusMap,
): void {
  const name = `${baseName(meta)}-${isoDatePart(schedule.date)}-${timePart(
    schedule.startTime,
  )}-${timePart(schedule.endTime)}.csv`;
  downloadCsv(name, [...ROSTER_CSV_HEADERS], buildShiftRows(meta, schedule, statusMap));
}
