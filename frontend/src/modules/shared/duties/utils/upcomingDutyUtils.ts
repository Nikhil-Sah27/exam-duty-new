import type { Duty } from "@/modules/duties/types";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";

/**
 * "Upcoming" = assigned duty whose end time hasn't passed yet. A duty that
 * finished earlier today (e.g. a 09:30–11:00 slot when it's now 14:00) drops
 * off into Completed, matching the dashboard and DCS/RS behaviour.
 */
export function filterUpcomingDuties(duties: Duty[]): Duty[] {
  return duties
    .filter((d) => d.status === "assigned")
    .filter((d) => isDutyUpcoming(d.date, d.endTime));
}

export function sortByNearestFirst(duties: Duty[]): Duty[] {
  return [...duties].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    return a.startTime.localeCompare(b.startTime);
  });
}

export interface TimeSlotGroup {
  startTime: string;
  endTime: string;
  duties: Duty[];
}

export interface DateGroup {
  /** ISO YYYY-MM-DD */
  dateKey: string;
  /** First duty's full date string — preserved so consumers can format with timezone. */
  date: string;
  timeSlots: TimeSlotGroup[];
}

/**
 * Group duties first by date (YYYY-MM-DD), then by time slot inside each date.
 * Sorted by date ascending, time-slot ascending.
 */
export function groupUpcomingDuties(duties: Duty[]): DateGroup[] {
  const sorted = sortByNearestFirst(duties);
  const byDate = new Map<string, Duty[]>();

  for (const d of sorted) {
    const key = new Date(d.date).toISOString().slice(0, 10);
    const list = byDate.get(key);
    if (list) list.push(d);
    else byDate.set(key, [d]);
  }

  return [...byDate.entries()].map(([dateKey, list]) => {
    const slots = new Map<string, TimeSlotGroup>();
    for (const duty of list) {
      const slotKey = `${duty.startTime}-${duty.endTime}`;
      const existing = slots.get(slotKey);
      if (existing) {
        existing.duties.push(duty);
      } else {
        slots.set(slotKey, {
          startTime: duty.startTime,
          endTime: duty.endTime,
          duties: [duty],
        });
      }
    }
    return {
      dateKey,
      date: list[0].date,
      timeSlots: [...slots.values()],
    };
  });
}

// ---- Display helpers -------------------------------------------------------

export function formatLongDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function formatDayName(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", { weekday: "long" });
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Build a best-effort exam label given a duty whose `exam` may be null
 * (new-flow duties). Falls back through:
 *   1. duty.exam.name                  — legacy single-exam model
 *   2. examGroup.examType + Sem        — new ExamGroup-based duties
 *   3. "Exam Duty"                     — last-resort
 */
export function describeExam(duty: Duty): string {
  if (duty.exam?.name) return duty.exam.name;
  const eg = duty.examSchedule?.examGroup;
  if (eg) return `${eg.examType} · Semester ${eg.semester}`;
  return "Exam Duty";
}

export interface RoomDisplay {
  roomNumber: string;
  buildingName: string;
  floor?: number;
  capacity?: number;
}

export function describeRoom(duty: Duty): RoomDisplay {
  const room = duty.examRoom?.room;
  return {
    roomNumber: room?.roomNumber || duty.room || "—",
    buildingName: room?.building?.name || "—",
    floor: room?.floor,
    capacity: room?.capacity,
  };
}

export function getDepartments(duty: Duty): string[] {
  if (duty.examRoom?.departments?.length) return duty.examRoom.departments;
  if (duty.exam?.department) return [duty.exam.department];
  return [];
}

export function getSemester(duty: Duty): number | string {
  return (
    duty.examSchedule?.examGroup?.semester ?? duty.exam?.semester ?? "—"
  );
}

export function getExamType(duty: Duty): string {
  return (
    duty.examSchedule?.examGroup?.examType ?? duty.exam?.type ?? "—"
  );
}
