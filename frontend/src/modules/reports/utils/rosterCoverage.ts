import type {
  DutyStatusMap,
  ExamGroupDetails,
  RoomDutyFlags,
} from "@/modules/exams/types";
import type { AvailableDutySlot } from "@/modules/shared/exams/selectors/examSelectors";
import { groupRoomsIntoRSGroups } from "@/modules/rs/select-duty/utils/rsDutyGroupingUtils";
import type { DcsGroup } from "@/modules/dcs/select-duty/types";

/**
 * Coverage maths for the Duty Roster report. The key subtlety this module
 * encodes: invigilators are staffed **per room**, but RS and DCS supervise a
 * **group of rooms** — so their denominators must be the number of duty groups
 * required, not the number of room slots. Counting RS/DCS per room (as a naive
 * tally would) makes the tiles claim far more slots — and far more vacancies —
 * than actually exist.
 */

const EMPTY_FLAGS: RoomDutyFlags = {
  dcsAssigned: false,
  rsAssigned: false,
  invigilatorAssigned: false,
};

export interface CoverageCount {
  /** How many slots (rooms for invigilators, groups for RS/DCS) are filled. */
  assigned: number;
  /** How many slots exist in total. */
  total: number;
}

export interface RosterCoverage {
  /** Total room slots across every schedule — the invigilator denominator. */
  rooms: number;
  invigilator: CoverageCount;
  /** Counted by RS duty group (≤5 rooms per building+slot). */
  rs: CoverageCount;
  /** Counted by persisted DCS group. */
  dcs: CoverageCount;
}

/**
 * Map the roster's schedule + room rows into the RS grouping engine's source
 * shape. We build the slots here rather than through the lifecycle-filtered
 * shared selector (`selectDutySlotsForGroup`) so the coverage tiles match the
 * full roster rendered below them — every schedule, past or upcoming, counts.
 */
export function toRsGroupingItems(
  details: ExamGroupDetails,
  statusMap: DutyStatusMap,
): AvailableDutySlot[] {
  const items: AvailableDutySlot[] = [];
  for (const schedule of details.schedules) {
    for (const examRoom of schedule.rooms) {
      const flags = statusMap[examRoom._id] ?? EMPTY_FLAGS;
      items.push({
        slotId: `${schedule._id}:${examRoom._id}`,
        scheduleId: schedule._id,
        examRoomId: examRoom._id,
        examGroupId: details._id,
        examType: details.examType,
        semester: details.semester,
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        roomId: examRoom.room._id,
        roomNumber: examRoom.room.roomNumber,
        buildingId: examRoom.room.building?._id ?? "unknown",
        buildingName: examRoom.room.building?.name ?? "Unknown",
        capacity: examRoom.room.capacity,
        departments: examRoom.departments,
        flags,
      });
    }
  }
  return items;
}

/**
 * Compute roster coverage with role-correct denominators:
 *  - Invigilators: per room slot.
 *  - RS: per RS duty group, derived through the shared `groupRoomsIntoRSGroups`
 *    so the count can never disagree with the RS Select-Duty / Upcoming views.
 *    A group counts as filled only when every room in it has an RS (group
 *    claims are transactional, so groups are all-or-nothing in practice).
 *  - DCS: per persisted DCS group; `claimed` groups are filled, `open` are not.
 */
export function computeRosterCoverage(
  details: ExamGroupDetails,
  statusMap: DutyStatusMap,
  dcsGroups: DcsGroup[],
): RosterCoverage {
  let rooms = 0;
  let invigilator = 0;
  for (const schedule of details.schedules) {
    for (const examRoom of schedule.rooms) {
      rooms += 1;
      if (statusMap[examRoom._id]?.invigilatorAssigned) invigilator += 1;
    }
  }

  const rsGroups = groupRoomsIntoRSGroups(toRsGroupingItems(details, statusMap));
  const rsAssigned = rsGroups.filter((g) => g.allAssigned).length;

  const dcsAssigned = dcsGroups.filter((g) => g.status === "claimed").length;

  return {
    rooms,
    invigilator: { assigned: invigilator, total: rooms },
    rs: { assigned: rsAssigned, total: rsGroups.length },
    dcs: { assigned: dcsAssigned, total: dcsGroups.length },
  };
}
