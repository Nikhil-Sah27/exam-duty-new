import type { ExamSchedule } from "@/modules/exams/types";

/**
 * The roster is presented as a two-level hierarchy: **day → shifts**. A day
 * gathers every schedule that falls on the same calendar date; a shift is a
 * single schedule (its start–end time window). This grouping is the single
 * source of that structure, used both for rendering and for the per-day /
 * per-shift CSV exports so the file boundaries match what's on screen.
 */

export interface RosterDay {
  /** Raw date string of the day (taken from its first schedule). */
  date: string;
  /** The day's schedules (shifts), in the order received. */
  shifts: ExamSchedule[];
  /** Total room slots across the day. */
  roomCount: number;
}

/** Calendar-date key that ignores any time component on the ISO string. */
const dayKey = (dateStr: string): string => {
  const t = dateStr.indexOf("T");
  return t >= 0 ? dateStr.slice(0, t) : dateStr;
};

/**
 * Group schedules into days, each carrying its shifts. Input order is
 * preserved (callers pass schedules pre-sorted by date then start time), so
 * days come out chronological and shifts within a day stay time-ordered.
 */
export function groupSchedulesByDay(schedules: ExamSchedule[]): RosterDay[] {
  const byDay = new Map<string, RosterDay>();
  for (const s of schedules) {
    const key = dayKey(s.date);
    const existing = byDay.get(key);
    if (existing) {
      existing.shifts.push(s);
      existing.roomCount += s.rooms.length;
    } else {
      byDay.set(key, { date: s.date, shifts: [s], roomCount: s.rooms.length });
    }
  }
  return [...byDay.values()];
}
