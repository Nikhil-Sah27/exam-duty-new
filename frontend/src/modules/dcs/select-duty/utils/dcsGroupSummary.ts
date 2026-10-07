import type { AssigneePublic } from "@/modules/exams/types";
import type { DutyGroupSummary } from "@/modules/shared/components/duty-group-summary/dutyGroupSummaryTypes";
import type { DcsGroup } from "../types";

/**
 * Adapter: project a DcsGroup into the common `DutyGroupSummary` shape the
 * shared DutyGroup* components render. Lives in the DCS module (not shared) so
 * the shared layer stays free of DCS-specific field knowledge — the dependency
 * points inward (dcs → shared), never the reverse.
 */
export function dcsGroupToSummary(
  group: DcsGroup,
  myUserId: string | null | undefined,
  /**
   * Cross-schedule display ordinal. When omitted the function falls back to
   * the backend per-schedule `groupIndex` — fine for single-card surfaces
   * but produces "Group #1" on every card across multiple schedules.
   */
  displayOrdinal?: number | null,
): DutyGroupSummary {
  const assignedToMe = Boolean(
    group.assignedTeacher && group.assignedTeacher._id === myUserId,
  );
  const occupied = Boolean(group.assignedTeacher) && !assignedToMe;
  const assignedTo: AssigneePublic | null = group.assignedTeacher
    ? {
        _id: group.assignedTeacher._id,
        name: group.assignedTeacher.name,
        email: group.assignedTeacher.email,
        phone: group.assignedTeacher.phone ?? null,
        roles: ["dcs"],
        department: group.assignedTeacher.department ?? null,
        designation: null,
      }
    : null;
  const ordinal = displayOrdinal ?? group.groupIndex;
  return {
    kind: "DCS",
    title: `DCS Duty Group #${ordinal}`,
    groupIndex: group.groupIndex,
    groupTotal: `${group.groupIndex}/${group.dcsRequired}`,
    buildingName: group.assignedRooms[0]?.room.building?.name ?? "—",
    date: group.schedule.date,
    startTime: group.schedule.startTime,
    endTime: group.schedule.endTime,
    rooms: group.assignedRooms.map((r) => ({
      examRoomId: r._id,
      roomNumber: r.room.roomNumber,
      floor: r.room.floor,
      buildingName: r.room.building?.name ?? "—",
    })),
    departments: group.assignedDepartments,
    studentCount: group.assignedStudents,
    assignedTo,
    isMine: assignedToMe,
    isOccupied: occupied,
  };
}
