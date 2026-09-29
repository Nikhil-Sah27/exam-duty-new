import type { DcsGroup } from "@/modules/dcs/select-duty/types";
import type { RSDutyGroup } from "@/modules/rs/select-duty/types";
import type { AssigneePublic } from "@/modules/exams/types";
import type { DutyGroupSummary } from "./duty-group-summary/dutyGroupSummaryTypes";

/**
 * Adapter: project a DcsGroup into the common summary shape used by the
 * card. Keeps the card decoupled from DCS-specific field naming so the same
 * component can render RS groups too.
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

export function rsGroupToSummary(group: RSDutyGroup): DutyGroupSummary {
  return {
    kind: "RS",
    title: `${group.buildingName} — ${group.rangeLabel}`,
    buildingName: group.buildingName,
    date: group.date,
    startTime: group.startTime,
    endTime: group.endTime,
    rooms: group.rooms.map((r) => ({
      examRoomId: r.examRoomId,
      roomNumber: r.roomNumber,
      // RS groups are always single-building (partitioned by building during
      // grouping), so every room inherits the group's building name.
      buildingName: group.buildingName,
    })),
    departments: group.departments,
    capacity: group.rooms.reduce((sum, r) => sum + r.capacity, 0),
    // RS groups are derived client-side and don't carry a single assignee —
    // every room has its own duty. The classroom modal still tells the
    // viewer if the slot is occupied via the per-role assignee on flags.
    assignedTo: null,
    isMine: false,
    isOccupied: group.allAssigned,
  };
}
