import type { ClassAssignmentRow } from "@/modules/shared/exams/selectors/dashboardSelectors";

/** "09:30" → "9:30", "14:00" → "2:00" (12-hour, no AM/PM — period shown separately). */
export function formatHM(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")}`;
}

/** "9:30 – 11:00" */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatHM(startTime)} – ${formatHM(endTime)}`;
}

/** Forenoon / Afternoon session label from the start time. */
export function sessionLabel(startTime: string): "FN" | "AN" {
  const [h] = startTime.split(":").map(Number);
  return h < 12 ? "FN" : "AN";
}

/** "IA2 · Sem 5 · CSE" (departments joined). */
export function examLabel(row: ClassAssignmentRow): string {
  const depts = row.departments.length > 0 ? row.departments.join(" / ") : "—";
  return `${row.examType} · Sem ${row.semester} · ${depts}`;
}

/** Room number + building name for display. */
export function roomLabel(row: ClassAssignmentRow): {
  room: string;
  building: string;
} {
  return {
    room: row.assignment.room.roomNumber,
    building: row.assignment.room.building?.name || "Unknown",
  };
}
