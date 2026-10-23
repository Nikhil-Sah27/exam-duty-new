import type { SlotAllocation, UsedRoomsMap } from "../types";
import { getSlotKey } from "../services/roomAllocation";
import { getEffectiveCapacity } from "../services/seatSharing";

export function getDisabledRoomsBySlot(
  slotAllocations: SlotAllocation[],
  usedRoomsMap: UsedRoomsMap
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const slot of slotAllocations) {
    const key = getSlotKey(slot.date, slot.shiftIndex);
    map.set(key, new Set(usedRoomsMap[key] || []));
  }
  return map;
}

export function getRoomWarnings(slotAllocations: SlotAllocation[]): string[] {
  const warnings: string[] = [];

  // Count DISTINCT departments short on rooms — a department spans many slots
  // (one per subject in SEE), so counting per-slot occurrences would wildly
  // overstate the number (e.g. "13 departments" for 2 departments × 13 exams).
  const insufficientDepts = new Set<string>();
  for (const slot of slotAllocations) {
    for (const dept of slot.departments) {
      if (!dept.courseId) continue;
      const effectiveCap = getEffectiveCapacity(dept);
      if (effectiveCap < dept.students) insufficientDepts.add(dept.departmentId);
    }
  }

  if (insufficientDepts.size > 0) {
    warnings.push(`${insufficientDepts.size} department(s) need more rooms`);
  }
  return warnings;
}
