import type { DepartmentAllocation, SlotAllocation, UnusedSeatInfo } from "../types";
import { calculateCapacity, classesNeeded, getSlotSummary } from "../services/roomAllocation";
import { getEffectiveCapacity as getIntraBatchEffectiveCapacity } from "../services/seatSharing";

/**
 * True effective capacity for a dept, including BOTH intra-batch shared seats
 * (received from another dept sharing a room in the same finalize batch) AND
 * global shared seats (received from another exam group's already-reserved
 * shareable room).
 */
function getGlobalSharedReceivedCount(dept: DepartmentAllocation): number {
  return dept.globalSharedReceived.reduce(
    (sum, c) => sum + c.studentsAllocated,
    0
  );
}

function getEffectiveCapacity(dept: DepartmentAllocation): number {
  return getIntraBatchEffectiveCapacity(dept) + getGlobalSharedReceivedCount(dept);
}

function getEffectiveRemaining(dept: DepartmentAllocation): number {
  return dept.students - getEffectiveCapacity(dept);
}

export { getGlobalSharedReceivedCount };

// ──────────────────────────────────────────────
// Department-level display stats (derived, never stored)
// ──────────────────────────────────────────────

export interface DeptDisplayStats {
  ownCapacity: number;
  effectiveCapacity: number;
  effectiveRemaining: number;
  /** Intra-batch shared seats received (sharedSeatsReceived). */
  sharedReceived: number;
  /** Global (cross-exam-group) shared seats received. */
  globalSharedReceived: number;
  extra: number;
  /**
   * Extra seats truly free for global sharing — subtracts intra-batch given
   * away seats so an owner who is already lending seats to another dept
   * within this batch can't accidentally over-commit the same physical space.
   */
  shareableExtra: number;
  capacityMet: boolean;
  needed: number;
  progressPct: number;
  ownPct: number;
}

export function getDeptDisplayStats(
  allocation: DepartmentAllocation,
  avgStudentsPerClass: number
): DeptDisplayStats {
  const { students, assignedRooms } = allocation;

  const ownCapacity = calculateCapacity(assignedRooms);
  const effectiveCapacity = getEffectiveCapacity(allocation);
  const effectiveRemaining = getEffectiveRemaining(allocation);
  const sharedReceived = allocation.sharedSeatsReceived.reduce(
    (s, r) => s + r.sharedStudents,
    0
  );
  const globalSharedReceived = getGlobalSharedReceivedCount(allocation);
  const extra = effectiveCapacity > students ? effectiveCapacity - students : 0;
  const intraGivenAway = allocation.sharedSeatsGiven.reduce(
    (s, r) => s + r.sharedStudents,
    0
  );
  const shareableExtra = Math.max(0, extra - intraGivenAway);
  const capacityMet = effectiveCapacity >= students;
  const needed = classesNeeded(Math.max(0, effectiveRemaining), avgStudentsPerClass);
  const progressPct =
    students > 0
      ? Math.min(100, Math.round((effectiveCapacity / students) * 100))
      : 0;
  const ownPct =
    students > 0
      ? Math.min(100, Math.round((ownCapacity / students) * 100))
      : 0;

  return {
    ownCapacity,
    effectiveCapacity,
    effectiveRemaining,
    sharedReceived,
    globalSharedReceived,
    extra,
    shareableExtra,
    capacityMet,
    needed,
    progressPct,
    ownPct,
  };
}

// ──────────────────────────────────────────────
// Slot-level effective summary (including shared seats)
// ──────────────────────────────────────────────

export interface SlotEffectiveSummary {
  activeDepts: DepartmentAllocation[];
  totalStudents: number;
  totalSharedSeats: number;
  effectiveTotalCapacity: number;
  effectiveAllCovered: boolean;
  effectiveRemaining: number;
  effectiveDeptsCovered: number;
  departmentsTotal: number;
  firstUncoveredIdx: number;
  progressPct: number;
}

export function getSlotEffectiveSummary(
  slot: SlotAllocation
): SlotEffectiveSummary {
  const activeDepts = slot.departments.filter((d) => d.courseId);
  const summary = getSlotSummary(activeDepts);

  const firstUncoveredIdx = activeDepts.findIndex(
    (d) => getEffectiveCapacity(d) < d.students
  );

  const totalSharedSeats = activeDepts.reduce(
    (sum, d) =>
      sum +
      d.sharedSeatsReceived.reduce((s, r) => s + r.sharedStudents, 0) +
      getGlobalSharedReceivedCount(d),
    0
  );

  const effectiveTotalCapacity = summary.totalCapacity + totalSharedSeats;
  const effectiveAllCovered =
    effectiveTotalCapacity >= summary.totalStudents;
  const effectiveRemaining = Math.max(
    0,
    summary.totalStudents - effectiveTotalCapacity
  );
  const effectiveDeptsCovered = activeDepts.filter(
    (d) => d.students > 0 && getEffectiveCapacity(d) >= d.students
  ).length;

  const progressPct =
    summary.totalStudents > 0
      ? Math.min(
          100,
          Math.round(
            (effectiveTotalCapacity / summary.totalStudents) * 100
          )
        )
      : 0;

  return {
    activeDepts,
    totalStudents: summary.totalStudents,
    totalSharedSeats,
    effectiveTotalCapacity,
    effectiveAllCovered,
    effectiveRemaining,
    effectiveDeptsCovered,
    departmentsTotal: summary.departmentsTotal,
    firstUncoveredIdx,
    progressPct,
  };
}

// ──────────────────────────────────────────────
// Global allocation stats across all slots
// ──────────────────────────────────────────────

export interface GlobalAllocationStats {
  totalStudents: number;
  totalCapacity: number;
  totalRoomsAssigned: number;
  totalSharedSeats: number;
  slotsCovered: number;
  slotsTotal: number;
  deptsCovered: number;
  deptsTotal: number;
  allCovered: boolean;
  progressPct: number;
}

export function getGlobalAllocationStats(
  slotAllocations: SlotAllocation[]
): GlobalAllocationStats {
  let totalStudents = 0;
  let totalCapacity = 0;
  let totalRoomsAssigned = 0;
  let totalSharedSeats = 0;
  let slotsCovered = 0;
  let slotsTotal = 0;

  // Count DISTINCT departments: a department spans many slots (one per subject
  // in SEE), so a department is "covered" only when EVERY slot it appears in is
  // covered. Counting per-slot would overstate the department total.
  const deptActive = new Set<string>();
  const deptUncovered = new Set<string>();

  for (const slot of slotAllocations) {
    const activeDepts = slot.departments.filter((d) => d.courseId);
    if (activeDepts.length === 0) continue;

    slotsTotal++;
    const summary = getSlotSummary(activeDepts);
    totalStudents += summary.totalStudents;

    let slotEffectiveCap = 0;
    let slotAllCovered = true;

    for (const dept of activeDepts) {
      totalRoomsAssigned += dept.assignedRooms.length;
      const shared =
        dept.sharedSeatsReceived.reduce((s, r) => s + r.sharedStudents, 0) +
        getGlobalSharedReceivedCount(dept);
      totalSharedSeats += shared;

      const effCap = getEffectiveCapacity(dept);
      slotEffectiveCap += effCap;

      if (dept.students > 0) {
        deptActive.add(dept.departmentId);
        if (effCap < dept.students) {
          deptUncovered.add(dept.departmentId);
          slotAllCovered = false;
        }
      }
    }

    totalCapacity += slotEffectiveCap;
    if (slotAllCovered) slotsCovered++;
  }

  const deptsTotal = deptActive.size;
  const deptsCovered = deptsTotal - deptUncovered.size;

  const progressPct =
    totalStudents > 0
      ? Math.min(100, Math.round((totalCapacity / totalStudents) * 100))
      : 0;

  return {
    totalStudents,
    totalCapacity,
    totalRoomsAssigned,
    totalSharedSeats,
    slotsCovered,
    slotsTotal,
    deptsCovered,
    deptsTotal,
    allCovered: totalCapacity >= totalStudents && totalStudents > 0,
    progressPct,
  };
}

// ──────────────────────────────────────────────
// Group unused seats by owner department (for modal display)
// ──────────────────────────────────────────────

export function groupSeatsByDept(
  unusedSeats: UnusedSeatInfo[]
): Map<string, UnusedSeatInfo[]> {
  const byDept = new Map<string, UnusedSeatInfo[]>();
  for (const seat of unusedSeats) {
    const key = seat.ownerDeptCode;
    if (!byDept.has(key)) byDept.set(key, []);
    byDept.get(key)!.push(seat);
  }
  return byDept;
}

// ──────────────────────────────────────────────
// Seat suggestion banner display info
// ──────────────────────────────────────────────

export interface SeatSuggestionInfo {
  totalAvailableSeats: number;
  canCover: number;
  coversAll: boolean;
  deptLabel: string;
}

export function getSeatSuggestionInfo(
  unusedSeats: UnusedSeatInfo[],
  remainingStudents: number
): SeatSuggestionInfo | null {
  if (unusedSeats.length === 0 || remainingStudents <= 0) return null;

  // Each dept's rooms all show the same budget. Deduplicate by dept to get true total.
  const budgetByDept = new Map<string, { code: string; budget: number }>();
  for (const seat of unusedSeats) {
    if (!budgetByDept.has(seat.ownerDeptId)) {
      budgetByDept.set(seat.ownerDeptId, {
        code: seat.ownerDeptCode,
        budget: seat.availableSeats,
      });
    }
  }

  const totalAvailableSeats = [...budgetByDept.values()].reduce(
    (sum, d) => sum + d.budget,
    0
  );

  if (totalAvailableSeats <= 0) return null;

  return {
    totalAvailableSeats,
    canCover: Math.min(totalAvailableSeats, remainingStudents),
    coversAll: totalAvailableSeats >= remainingStudents,
    deptLabel: [...budgetByDept.values()].map((d) => d.code).join(", "),
  };
}
