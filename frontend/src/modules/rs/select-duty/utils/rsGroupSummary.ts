import type { DutyGroupSummary } from "@/modules/shared/components/duty-group-summary/dutyGroupSummaryTypes";
import type { RSDutyGroup } from "../types";

/**
 * Adapter: project a derived RSDutyGroup into the common `DutyGroupSummary`
 * shape the shared DutyGroup* components render. Lives in the RS module so the
 * shared layer never imports RS-specific types (dependency points rs → shared).
 */
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
    // every room has its own duty. The classroom modal still tells the viewer
    // if the slot is occupied via the per-role assignee on flags.
    assignedTo: null,
    isMine: false,
    isOccupied: group.allAssigned,
  };
}
