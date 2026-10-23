// Client-side gates for change requests. Each block names the web file it was
// ported from — keep them in sync. The backend (changeRequest.service
// submitRequest) re-checks everything; these only stop the app offering a
// request the server would refuse.

import type { DcsGroup } from "@/features/select-duty/shared/dcsTypes";
import type { Duty } from "@/features/select-duty/shared/dutyTypes";
import type { RSDutyGroup } from "@/features/select-duty/shared/rsTypes";

import type { RSUpcomingGroup } from "./shared/rsUpcomingGrouping";
import type { ChangeRequest, ReplacementSlot } from "./types";

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

// ── frontend/src/modules/shared/change-requests/utils/dutyConflictUtils.ts ──

const toMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const sameDay = (a: string, b: string): boolean => {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return da.getTime() === db.getTime();
};

const overlaps = (aS: string, aE: string, bS: string, bE: string): boolean =>
  toMinutes(aS) < toMinutes(bE) && toMinutes(bS) < toMinutes(aE);

/**
 * Does the user have another active duty that overlaps the replacement slot's
 * time window? Excludes the duty currently being moved.
 */
export function findConflictingDuty(slot: ReplacementSlot, myDuties: Duty[], excludeDutyId: string): Duty | null {
  return (
    myDuties.find(
      (d) =>
        d._id !== excludeDutyId &&
        d.status === "assigned" &&
        sameDay(d.date, slot.date) &&
        overlaps(d.startTime, d.endTime, slot.startTime, slot.endTime),
    ) || null
  );
}

// ── frontend/src/modules/shared/change-requests/utils/changeRequestValidation.ts ──

const TODAY_START = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Can the logged-in invigilator submit a change request against this duty?
 * Mirrors the backend gate: only own, assigned, not-past duties.
 */
export function canRequestChange(duty: Duty): ValidationResult {
  if (duty.status !== "assigned") {
    return { ok: false, reason: "This duty is no longer active." };
  }
  const dutyDay = new Date(duty.date);
  dutyDay.setHours(0, 0, 0, 0);
  if (dutyDay < TODAY_START()) {
    return { ok: false, reason: "Cannot request changes for a past duty." };
  }
  return { ok: true };
}

export function hasPendingRequest(dutyId: string, myRequests: ChangeRequest[]): boolean {
  return myRequests.some((r) => r.duty?._id === dutyId && r.status === "pending");
}

/** Is `slot` a valid replacement target for the user moving away from `currentDuty`? */
export function canSelectReplacement(slot: ReplacementSlot, currentDuty: Duty, myDuties: Duty[]): ValidationResult {
  const slotDay = new Date(slot.date);
  slotDay.setHours(0, 0, 0, 0);
  if (slotDay < TODAY_START()) {
    return { ok: false, reason: "Slot is in the past." };
  }
  const conflict = findConflictingDuty(slot, myDuties, currentDuty._id);
  if (conflict) {
    return {
      ok: false,
      reason: `You already have another duty during this time (${conflict.room} ${conflict.startTime}–${conflict.endTime}).`,
    };
  }
  return { ok: true };
}

// ── frontend/src/modules/invigilator/change-requests/pages/InvigilatorChangeRequestsPage.tsx ──

/** Upcoming, assigned duties (not past, not cancelled, not completed), soonest first. */
export function upcomingAssignedDuties(duties: readonly Duty[]): Duty[] {
  const today = TODAY_START();
  return duties
    .filter((d) => {
      if (d.status !== "assigned") return false;
      const day = new Date(d.date);
      day.setHours(0, 0, 0, 0);
      return day >= today;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ── frontend/src/modules/rs/change-requests (page + RsSwapTargetModal) ──

/** rsSourceKeys that already have a pending rs_swap — one swap per group at a time. */
export function pendingRsSourceKeys(myRequests: readonly ChangeRequest[]): Set<string> {
  const keys = new Set<string>();
  for (const r of myRequests) {
    if (r.status === "pending" && r.scope === "rs_group" && r.rsSourceKey) keys.add(r.rsSourceKey);
  }
  return keys;
}

/**
 * Target groups for an RS swap (RsSwapTargetModal.eligibleTargets): every
 * derived RS group except the source, any group with an RS already on one of
 * its rooms, and any whose window clashes with the requester's OTHER duties.
 *
 * `myDuties` is every role's duties (the backend's submit check spans all
 * roles); the web passes only RS duties, so this is stricter, never looser.
 */
export function eligibleRsSwapTargets(
  allGroups: readonly RSDutyGroup[],
  source: RSUpcomingGroup,
  myDuties: readonly Duty[],
): RSDutyGroup[] {
  const sourceDutyIds = new Set(source.rooms.map((r) => r.dutyId));
  const otherDuties = myDuties.filter((d) => !sourceDutyIds.has(d._id));
  return allGroups.filter((g) => {
    if (g.groupId === source.groupId) return false;
    if (g.allAssigned) return false;
    // If any target room already has a persisted RS duty, the target is not free.
    if (g.rooms.some((r) => r.flags.rsAssigned)) return false;
    // Time conflict with any OTHER duty of the requester?
    const clash = otherDuties.some((d) => {
      if (!sameDay(d.date, g.date)) return false;
      if (d.status !== "assigned") return false;
      return overlaps(d.startTime, d.endTime, g.startTime, g.endTime);
    });
    return !clash;
  });
}

// ── frontend/src/modules/dcs/change-requests (page + useDcsChangeRequests) ──
// and frontend/src/modules/duties/services/dcsGroupingService.ts hasTimeConflict

export interface ConflictWindow {
  date: string;
  startTime: string;
  endTime: string;
}

export const hasTimeConflict = (group: DcsGroup, blockers: ConflictWindow[]): boolean => {
  const gDay = new Date(group.schedule.date).toDateString();
  const gStart = toMinutes(group.schedule.startTime);
  const gEnd = toMinutes(group.schedule.endTime);
  return blockers.some((b) => {
    if (new Date(b.date).toDateString() !== gDay) return false;
    return toMinutes(b.startTime) < gEnd && gStart < toMinutes(b.endTime);
  });
};

/** DcsChangeRequestsPage.isUpcoming — schedule day is today or later. */
export const isDcsGroupUpcoming = (group: DcsGroup): boolean => {
  const day = new Date(group.schedule.date);
  day.setHours(0, 0, 0, 0);
  return day >= TODAY_START();
};

/** Source group ids that already have a pending dcs_swap. */
export function pendingDcsSourceIds(myRequests: readonly ChangeRequest[]): Set<string> {
  const ids = new Set<string>();
  for (const r of myRequests) {
    if (r.status === "pending" && r.dcsSourceGroup?._id) ids.add(r.dcsSourceGroup._id);
  }
  return ids;
}

/**
 * Target groups for a DCS swap (useDcsSwapTargets): open groups other than the
 * source, today or later, that don't clash with the viewer's other claimed
 * groups. Like the backend submit check, the viewer's other-role duties outside
 * the source group block too (the web only checks other DCS groups).
 */
export function eligibleDcsSwapTargets(
  openGroups: readonly DcsGroup[],
  source: DcsGroup,
  ownedGroups: readonly DcsGroup[],
  myDuties: readonly Duty[],
): DcsGroup[] {
  const sourceDutyIds = new Set((source.duties ?? []).map(String));
  const blockers: ConflictWindow[] = ownedGroups
    .filter((g) => g._id !== source._id)
    .map((g) => ({ date: g.schedule.date, startTime: g.schedule.startTime, endTime: g.schedule.endTime }));
  for (const d of myDuties) {
    if (d.status !== "assigned" || sourceDutyIds.has(d._id)) continue;
    // The source group's own duties (in case `duties` wasn't returned).
    if (d.role === "dcs" && d.examSchedule?._id === source.schedule._id) continue;
    blockers.push({ date: d.date, startTime: d.startTime, endTime: d.endTime });
  }

  const today = TODAY_START();
  return openGroups
    .filter((g) => g._id !== source._id)
    .filter((g) => {
      const d = new Date(g.schedule.date);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    })
    .filter((g) => !hasTimeConflict(g, blockers));
}
