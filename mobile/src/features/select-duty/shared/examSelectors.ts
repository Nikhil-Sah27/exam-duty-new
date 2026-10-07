// Copied verbatim from frontend/src/modules/shared/exams/selectors/examSelectors.ts — keep in sync; never re-derive this logic ad hoc.
// Only import paths were changed for the mobile tree.

import type {
  ExamGroup,
  ExamGroupDetails,
  DutyStatusMap,
  RoomDutyFlags,
} from "./examTypes";
import { isDutySelectable } from "./dutyStatusFilter";

export interface AvailableDutySlot {
  slotId: string; // `${scheduleId}:${examRoomId}`
  scheduleId: string;
  examRoomId: string;
  examGroupId: string;
  examType: ExamGroup["examType"];
  semester: number;
  date: string;
  startTime: string;
  endTime: string;
  roomId: string;
  roomNumber: string;
  /** Stable id of the building, used by the RS grouping engine to partition
   *  rooms (`buildingName` can collide across buildings; `buildingId` cannot). */
  buildingId: string;
  buildingName: string;
  capacity: number;
  departments: string[];
  /**
   * Full per-role occupancy for this room+time. Role-aware consumers (e.g.
   * the Select Duty page filtering "FULL" slots) read the appropriate key
   * based on the logged-in user's role via @/modules/shared/role-config.
   */
  flags: RoomDutyFlags;
}

/**
 * Keep only exam groups that still have at least one selectable schedule
 * (`endDate` covers anything later than today). Per-schedule eligibility is
 * applied in `selectDutySlotsForGroup` via the shared lifecycle filter.
 */
export function selectActiveExamGroups(groups: ExamGroup[]): ExamGroup[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return groups.filter((g) => {
    const end = new Date(g.endDate);
    end.setHours(23, 59, 59, 999);
    return end >= now;
  });
}

interface BuildSlotsInput {
  group: ExamGroup;
  details: ExamGroupDetails;
  dutyStatus: DutyStatusMap;
}

/**
 * Derive duty slots from a single group's schedules + rooms + duty status.
 * One slot per (schedule × examRoom). Slots are emitted regardless of
 * occupancy; the caller filters out FULL based on the logged-in user's role
 * (e.g. `slot.flags.invigilatorAssigned` for invigilators, `rsAssigned` for RS).
 *
 * Filtering rules applied here:
 *  - drop schedules that aren't in a selectable lifecycle state (Upcoming or
 *    Ongoing) — delegated to the shared `isDutySelectable` so Invigilator/RS
 *    visibility matches DCS and any future teacher role
 *  - drop schedules with no rooms (would yield zero slots anyway)
 */
export function selectDutySlotsForGroup({
  group,
  details,
  dutyStatus,
}: BuildSlotsInput): AvailableDutySlot[] {
  const slots: AvailableDutySlot[] = [];

  for (const schedule of details.schedules) {
    if (
      !isDutySelectable({
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      })
    ) {
      continue;
    }
    if (schedule.rooms.length === 0) continue;

    for (const examRoom of schedule.rooms) {
      const flags: RoomDutyFlags = dutyStatus[examRoom._id] || {
        dcsAssigned: false,
        rsAssigned: false,
        invigilatorAssigned: false,
      };
      slots.push({
        slotId: `${schedule._id}:${examRoom._id}`,
        scheduleId: schedule._id,
        examRoomId: examRoom._id,
        examGroupId: group._id,
        examType: group.examType,
        semester: group.semester,
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        roomId: examRoom.room._id,
        roomNumber: examRoom.room.roomNumber,
        buildingId: examRoom.room.building?._id || "unknown",
        buildingName: examRoom.room.building?.name || "Unknown",
        capacity: examRoom.room.capacity,
        departments: examRoom.departments,
        flags,
      });
    }
  }

  return slots;
}

/** Compose slots from many groups' details into one flat array. */
export function selectAvailableDutySlots(
  inputs: BuildSlotsInput[]
): AvailableDutySlot[] {
  return inputs.flatMap(selectDutySlotsForGroup);
}
