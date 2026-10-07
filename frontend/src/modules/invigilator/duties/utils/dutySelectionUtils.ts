import type { Duty } from "@/modules/duties/types";
import type { RoomDutyFlags } from "@/modules/shared/exams/types/exam.types";

export type DutySelectionState =
  | "AVAILABLE"
  | "SELECTED_BY_ME"
  | "FULLY_OCCUPIED"
  | "PENDING"
  | "CONFLICT";

/**
 * Identifies a room+time slot for selection purposes. The full RoomDutyFlags
 * payload is carried so per-role occupancy can be checked without re-fetching.
 */
export interface SlotContext {
  date: string;
  startTime: string;
  endTime: string;
  roomNumber: string;
  roomId: string;
  flags: RoomDutyFlags;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return da.getTime() === db.getTime();
}

function overlaps(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

/**
 * Match a duty against the target slot using the room's ObjectId when either
 * side exposes it (`examRoom.room._id`). Falls back to the legacy string
 * comparison only when neither side has an id — the string form is a bare
 * room number and would falsely collide across buildings (e.g. "004" in the
 * Academic Block vs "004" in the Lab Block).
 */
function dutyMatchesSlot(d: Duty, slot: SlotContext): boolean {
  const dutyRoomId = d.examRoom?.room?._id;
  if (dutyRoomId && slot.roomId) {
    return dutyRoomId === slot.roomId;
  }
  return d.room === slot.roomNumber;
}

/**
 * Does the current user already hold a duty FOR THIS ROLE in this exact
 * slot+room? Role-scoped: holding the invigilator slot of a room is not the
 * same as holding its RS slot. `viewerRole` omitted → role-agnostic (legacy).
 */
export function isSelectedByMe(
  slot: SlotContext,
  myDuties: Duty[],
  viewerRole?: string,
): boolean {
  return myDuties.some((d) => {
    if (d.status !== "assigned") return false;
    if (viewerRole && (d.role ?? "invigilator") !== viewerRole) return false;
    if (!sameDay(d.date, slot.date)) return false;
    if (d.startTime !== slot.startTime || d.endTime !== slot.endTime) return false;
    return dutyMatchesSlot(d, slot);
  });
}

export function hasTimeConflict(
  slot: SlotContext,
  myDuties: Duty[],
  viewerRole?: string,
): boolean {
  return myDuties.some((d) => {
    if (d.status !== "assigned") return false;
    if (!sameDay(d.date, slot.date)) return false;
    // Only the viewer's OWN-role duty in this exact slot is "mine" (not a
    // conflict). A different-role duty at the same room+time clashes: the
    // person can't staff two roles at once.
    const ownRoleHere =
      (!viewerRole || (d.role ?? "invigilator") === viewerRole) &&
      d.startTime === slot.startTime &&
      d.endTime === slot.endTime &&
      dutyMatchesSlot(d, slot);
    if (ownRoleHere) return false;
    return overlaps(d.startTime, d.endTime, slot.startTime, slot.endTime);
  });
}

/** True when the role-specific slot on this room is already occupied. */
export function isRoleSlotFull(
  slot: SlotContext,
  flagKey: keyof RoomDutyFlags
): boolean {
  return Boolean(slot.flags[flagKey]);
}

export function isDutyAvailable(
  slot: SlotContext,
  myDuties: Duty[],
  flagKey: keyof RoomDutyFlags,
  isPending: boolean = false,
  viewerRole?: string,
): boolean {
  if (isPending) return false;
  if (isRoleSlotFull(slot, flagKey)) return false;
  if (isSelectedByMe(slot, myDuties, viewerRole)) return false;
  if (hasTimeConflict(slot, myDuties, viewerRole)) return false;
  return true;
}

export function deriveSelectionState(
  slot: SlotContext,
  myDuties: Duty[],
  flagKey: keyof RoomDutyFlags,
  isPending: boolean = false,
  viewerRole?: string,
): DutySelectionState {
  if (isSelectedByMe(slot, myDuties, viewerRole)) return "SELECTED_BY_ME";
  if (isPending) return "PENDING";
  if (isRoleSlotFull(slot, flagKey)) return "FULLY_OCCUPIED";
  if (hasTimeConflict(slot, myDuties, viewerRole)) return "CONFLICT";
  return "AVAILABLE";
}
