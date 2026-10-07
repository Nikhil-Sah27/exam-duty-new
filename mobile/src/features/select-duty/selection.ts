import type { ConflictWindow } from "./shared/dutyConflictUtils";
import { getConflictReason, isTimeConflict } from "./shared/dutyConflictUtils";
import type { DcsGroup } from "./shared/dcsTypes";
import type { Duty } from "./shared/dutyTypes";
import type { AvailableDutySlot } from "./shared/examSelectors";
import type { RSDutyGroup } from "./shared/rsTypes";

/**
 * Per-role card state machines, ported from the web Select Duty hooks:
 *   invigilator/select-duty/hooks/useDutySelection.ts (+ utils/dutyValidationUtils.ts)
 *   rs/select-duty/hooks/useRSDutyAvailability.ts
 *   dcs/select-duty/hooks/useDcsDutySelection.ts
 * Conflict detection is the shared engine (./shared/dutyConflictUtils) for all three.
 *
 * One mobile addition: invigilator/RS cards the viewer already holds read
 * "Yours" (MINE) instead of the generic "Occupied" — the same distinction the
 * DCS flow already makes. Detected from the viewer's own duties, never from
 * the assignee identity the duty-status API returns.
 */

export type CardState = "AVAILABLE" | "SELECTED" | "MINE" | "FULL" | "CONFLICT";

export interface Validation {
  ok: boolean;
  reason?: string;
}

export interface Blockers {
  selected: readonly ConflictWindow[];
  myDuties: readonly Duty[];
}

const FRIENDLY_BANNER = (count: number): string =>
  count === 1
    ? "1 duty is hidden because it overlaps with your current selection."
    : `${count} duties are hidden because they overlap with your current selection.`;

/** Port of useDutyConflicts().summarize — the amber banner above the list. */
export function summarizeConflicts(pool: readonly ConflictWindow[], blockers: Blockers): string | null {
  let hidden = 0;
  for (const c of pool) if (isTimeConflict(c, blockers)) hidden += 1;
  return hidden > 0 ? FRIENDLY_BANNER(hidden) : null;
}

const holdsRoom = (myDuties: readonly Duty[], examRoomId: string, role: "invigilator" | "rs") =>
  myDuties.some(
    (d) => d.status === "assigned" && (d.role ?? "invigilator") === role && d.examRoom?._id === examRoomId,
  );

// ── Invigilator: one room per card ───────────────────────────────────────

export const slotWindow = (s: AvailableDutySlot): ConflictWindow => ({
  id: s.slotId,
  date: s.date,
  startTime: s.startTime,
  endTime: s.endTime,
  roomNumber: s.roomNumber,
});

export function invigilatorStateOf(slot: AvailableDutySlot, selectedIds: Set<string>, blockers: Blockers): CardState {
  if (selectedIds.has(slot.slotId)) return "SELECTED";
  if (slot.flags.invigilatorAssigned) {
    return holdsRoom(blockers.myDuties, slot.examRoomId, "invigilator") ? "MINE" : "FULL";
  }
  if (isTimeConflict(slotWindow(slot), blockers)) return "CONFLICT";
  return "AVAILABLE";
}

/** Port of validateSelection (invigilator/select-duty/utils/dutyValidationUtils.ts). */
export function invigilatorValidate(slot: AvailableDutySlot, selectedIds: Set<string>, blockers: Blockers): Validation {
  if (slot.flags.invigilatorAssigned) {
    return { ok: false, reason: "This slot already has an invigilator assigned." };
  }
  if (selectedIds.has(slot.slotId)) {
    return { ok: false, reason: "This slot is already in your selection." };
  }
  const reason = getConflictReason(slotWindow(slot), blockers);
  if (reason) return { ok: false, reason };
  return { ok: true };
}

// ── RS: derived group of ≤5 rooms per card ──────────────────────────────

export const rsGroupWindow = (g: RSDutyGroup): ConflictWindow => ({
  id: g.groupId,
  date: g.date,
  startTime: g.startTime,
  endTime: g.endTime,
  roomNumber: g.rangeLabel,
});

export function rsStateOf(group: RSDutyGroup, selectedIds: Set<string>, blockers: Blockers): CardState {
  if (selectedIds.has(group.groupId)) return "SELECTED";
  if (group.allAssigned) {
    const allMine = group.rooms.every((r) => holdsRoom(blockers.myDuties, r.examRoomId, "rs"));
    return allMine ? "MINE" : "FULL";
  }
  if (isTimeConflict(rsGroupWindow(group), blockers)) return "CONFLICT";
  return "AVAILABLE";
}

export function rsValidate(group: RSDutyGroup, selectedIds: Set<string>, blockers: Blockers): Validation {
  if (group.allAssigned) {
    return { ok: false, reason: "Every room in this group already has an RS assigned." };
  }
  if (selectedIds.has(group.groupId)) {
    return { ok: false, reason: "This group is already in your selection." };
  }
  const reason = getConflictReason(rsGroupWindow(group), blockers);
  if (reason) return { ok: false, reason };
  return { ok: true };
}

/** Rooms in a not-yet-full RS group that already have an RS (the backend will refuse the group). */
export const rsTakenRooms = (group: RSDutyGroup): number => group.rooms.filter((r) => r.flags.rsAssigned).length;

// ── DCS: persisted DCSGroup per card ─────────────────────────────────────

export const dcsGroupWindow = (g: DcsGroup): ConflictWindow => ({
  id: g._id,
  date: g.schedule.date,
  startTime: g.schedule.startTime,
  endTime: g.schedule.endTime,
});

/** Same precedence as the web: claimed (MINE/OCCUPIED) → SELECTED → CONFLICT → AVAILABLE. */
export function dcsStateOf(group: DcsGroup, userId: string | undefined, selectedIds: Set<string>, blockers: Blockers): CardState {
  if (group.status === "claimed") {
    return group.assignedTeacher?._id === userId ? "MINE" : "FULL";
  }
  if (selectedIds.has(group._id)) return "SELECTED";
  if (isTimeConflict(dcsGroupWindow(group), blockers)) return "CONFLICT";
  return "AVAILABLE";
}

export function dcsValidate(group: DcsGroup, userId: string | undefined, selectedIds: Set<string>, blockers: Blockers): Validation {
  const state = dcsStateOf(group, userId, selectedIds, blockers);
  if (state === "FULL") return { ok: false, reason: "Already taken by another DCS." };
  if (state === "MINE") return { ok: false, reason: "You've already claimed this group." };
  if (state === "CONFLICT") {
    return {
      ok: false,
      reason:
        getConflictReason(dcsGroupWindow(group), blockers) ||
        "This time conflicts with another duty you hold or have selected.",
    };
  }
  return { ok: true };
}
