import type { ExamRoomAssignment } from "@/modules/exams/types";

/**
 * Shared presentation helpers for the Duty Roster report. Kept in one place so
 * the on-screen tables and the CSV exports label rooms, departments, and roles
 * identically — a room can never read one way in the UI and another in the file.
 */

/** The three duty roles a room carries, in display order. `key` indexes the
 *  populated assignee on `RoomDutyFlags`; `flag` is its boolean counterpart. */
export const ROLES = [
  { key: "invigilatorTeacher", flag: "invigilatorAssigned", label: "Invigilator" },
  { key: "rsTeacher", flag: "rsAssigned", label: "RS" },
  { key: "dcsTeacher", flag: "dcsAssigned", label: "DCS" },
] as const;

/**
 * Uniform department-chip styling. Every department renders in the SAME orange
 * on purpose — the per-department palette (shared `deptColor`) turns a dense
 * roster or exam list into a distracting rainbow, so reports opt out of it.
 */
export const DEPARTMENT_CHIP_CLASS =
  "inline-flex rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700";

export const roomLabel = (r: ExamRoomAssignment) =>
  `${r.room.building?.name ?? "—"} · ${r.room.roomNumber}`;

export const departmentLabel = (r: ExamRoomAssignment) =>
  r.departments?.length ? r.departments.join(", ") : "—";

/** Stable room order: by building name, then room number (numeric-aware). */
export const sortRooms = (rooms: ExamRoomAssignment[]) =>
  [...rooms].sort((a, b) => {
    const byBuilding = (a.room.building?.name ?? "").localeCompare(
      b.room.building?.name ?? "",
    );
    if (byBuilding !== 0) return byBuilding;
    return a.room.roomNumber.localeCompare(b.room.roomNumber, undefined, {
      numeric: true,
    });
  });
