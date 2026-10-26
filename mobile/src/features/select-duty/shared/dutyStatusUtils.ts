import type { DutyStatus, RoomDutyFlags } from "./examTypes";

// Port of frontend/src/modules/shared/exams/utils/dutyStatusUtils.ts (status
// logic only) — keep the two identical.

export function getDutyStatus(flags: RoomDutyFlags | undefined): DutyStatus {
  if (!flags) return "NOT_ASSIGNED";
  const { dcsAssigned, rsAssigned, invigilatorAssigned } = flags;
  if (!dcsAssigned && !rsAssigned && !invigilatorAssigned) return "NOT_ASSIGNED";
  if (dcsAssigned && rsAssigned && invigilatorAssigned) return "FULLY_ASSIGNED";
  return "PARTIAL";
}

export function getStatusLabel(status: DutyStatus): string {
  switch (status) {
    case "FULLY_ASSIGNED":
      return "Fully Assigned";
    case "PARTIAL":
      return "Partially Assigned";
    case "NOT_ASSIGNED":
    default:
      return "Not Assigned";
  }
}
