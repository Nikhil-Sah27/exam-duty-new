import type { Duty } from "@/modules/duties/types";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";
import type {
  DashboardDutyItem,
  DashboardRoomRef,
  DashboardRoleLabel,
} from "../types";

/**
 * Pure normalizers — no I/O, no hooks. They translate plain `Duty` rows into
 * the shared `DashboardDutyItem` so the same card/section can render them.
 *
 * Role-specific shapes (DCS groups, RS room-groups) are normalized inside
 * their own modules — see `dcs/upcoming-duties/utils/dcsDashboardNormalizers`
 * and `rs/upcoming-duties/utils/rsDashboardNormalizers`. This file must stay
 * role-agnostic: it defines the contract, roles adapt to it.
 */

// Upcoming/completed split shared with the Upcoming Duties pages — see
// `shared/duties/utils/dutyTiming`.
const isUpcoming = isDutyUpcoming;

function isCompleted(dateStr: string, endTime: string, status?: string): boolean {
  if (status === "cancelled") return false;
  if (status === "completed") return true;
  return !isUpcoming(dateStr, endTime);
}

// ── Duty (Invigilator / RS) ─────────────────────────────────────────────

/**
 * One Duty becomes one card. Rooms in the same time slot are NOT merged into
 * a single card here — invigilators map to one room each, and the existing
 * Upcoming Duties pages already render this granularity, so we stay
 * consistent.
 */
function dutyToItem(d: Duty, roleLabel: DashboardRoleLabel, hrefBase?: string): DashboardDutyItem {
  const room = d.examRoom?.room;
  const rooms: DashboardRoomRef[] = [
    {
      id: d._id,
      roomNumber: room?.roomNumber || d.room || "—",
      building: room?.building?.name,
      floor: room?.floor,
    },
  ];

  const examType =
    d.examSchedule?.examGroup?.examType ?? d.exam?.type ?? undefined;
  const semester =
    d.examSchedule?.examGroup?.semester ?? d.exam?.semester ?? undefined;
  const departments = d.examRoom?.departments?.length
    ? d.examRoom.departments
    : d.exam?.department
      ? [d.exam.department]
      : [];

  return {
    id: d._id,
    examType: examType ? String(examType) : undefined,
    semester,
    date: d.date,
    startTime: d.startTime,
    endTime: d.endTime,
    rooms,
    departments,
    href: hrefBase,
    roleLabel,
  };
}

export interface NormalizeDutiesOptions {
  duties: readonly Duty[];
  roleLabel: DashboardRoleLabel;
}

export function normalizeDutiesUpcoming({
  duties,
  roleLabel,
}: NormalizeDutiesOptions): DashboardDutyItem[] {
  return duties
    .filter((d) => d.status === "assigned" && isUpcoming(d.date, d.endTime))
    .sort(byDateTime)
    .map((d) => dutyToItem(d, roleLabel));
}

export function normalizeDutiesCompleted({
  duties,
  roleLabel,
}: NormalizeDutiesOptions): DashboardDutyItem[] {
  return duties
    .filter((d) => isCompleted(d.date, d.endTime, d.status))
    .sort(byDateTimeDesc)
    .map((d) => dutyToItem(d, roleLabel));
}

function byDateTime(a: Duty, b: Duty): number {
  const da = new Date(a.date).getTime();
  const db = new Date(b.date).getTime();
  if (da !== db) return da - db;
  return a.startTime.localeCompare(b.startTime);
}

function byDateTimeDesc(a: Duty, b: Duty): number {
  return -byDateTime(a, b);
}
