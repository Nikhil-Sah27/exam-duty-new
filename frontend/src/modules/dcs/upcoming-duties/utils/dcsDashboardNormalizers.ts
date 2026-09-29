import type { DcsGroup } from "../../select-duty/types";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";
import type {
  DashboardDutyItem,
  DashboardRoomRef,
} from "@/modules/shared/dashboard/types";

/**
 * DCS → shared dashboard adapters. Pure — no I/O, no hooks. Lives in the DCS
 * module (not shared/dashboard) so the shared layer never has to know about
 * DCS group shapes; DCS adapts its data to the shared `DashboardDutyItem`
 * contract instead.
 */

function dcsGroupToItem(g: DcsGroup, hrefBase?: string): DashboardDutyItem {
  const rooms: DashboardRoomRef[] = g.assignedRooms.map((er) => ({
    id: er._id,
    roomNumber: er.room?.roomNumber ?? "—",
    building: er.room?.building?.name,
    floor: er.room?.floor,
  }));
  return {
    id: g._id,
    examType: g.examGroup?.examType,
    semester: g.examGroup?.semester,
    date: g.schedule.date,
    startTime: g.schedule.startTime,
    endTime: g.schedule.endTime,
    rooms,
    departments: g.assignedDepartments,
    students: g.assignedStudents,
    href: hrefBase,
    roleLabel: "DCS",
  };
}

export interface NormalizeDcsOptions {
  groups: readonly DcsGroup[];
}

export function normalizeDcsUpcoming({ groups }: NormalizeDcsOptions): DashboardDutyItem[] {
  return groups
    .filter((g) => g.status === "claimed" && isDutyUpcoming(g.schedule.date, g.schedule.endTime))
    .sort(byScheduleAsc)
    .map((g) => dcsGroupToItem(g));
}

export function normalizeDcsCompleted({ groups }: NormalizeDcsOptions): DashboardDutyItem[] {
  return groups
    .filter(
      (g) =>
        g.status === "claimed" &&
        !isDutyUpcoming(g.schedule.date, g.schedule.endTime),
    )
    .sort(byScheduleDesc)
    .map((g) => dcsGroupToItem(g));
}

function byScheduleAsc(a: DcsGroup, b: DcsGroup): number {
  const da = new Date(a.schedule.date).getTime();
  const db = new Date(b.schedule.date).getTime();
  if (da !== db) return da - db;
  return a.schedule.startTime.localeCompare(b.schedule.startTime);
}

function byScheduleDesc(a: DcsGroup, b: DcsGroup): number {
  return -byScheduleAsc(a, b);
}
