import type { Duty } from "@/modules/duties/types";
import {
  groupRSDutiesIntoUpcomingGroups,
  type RSUpcomingGroup,
} from "./rsUpcomingGrouping";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";
import type {
  DashboardDutyItem,
  DashboardRoomRef,
} from "@/modules/shared/dashboard/types";

/**
 * RS → shared dashboard adapters. Pure — no I/O, no hooks. Lives in the RS
 * module (not shared/dashboard) so the shared layer never has to know about
 * RS room-group derivation; RS adapts its groups to the shared
 * `DashboardDutyItem` contract instead.
 */

/**
 * Turn a client-derived RSUpcomingGroup into a shared dashboard card. RS is a
 * group role (5 rooms per chunk within a schedule + building), so we surface
 * the whole group's rooms as chips — never one card per room.
 */
function rsGroupToItem(g: RSUpcomingGroup): DashboardDutyItem {
  const rooms: DashboardRoomRef[] = g.rooms.map((r) => ({
    id: r.dutyId,
    roomNumber: r.roomNumber,
    building: g.buildingName,
    floor: r.floor,
  }));
  return {
    id: g.groupId,
    examType: g.examType || undefined,
    semester: g.semester,
    date: g.date,
    startTime: g.startTime,
    endTime: g.endTime,
    rooms,
    departments: g.departments,
    roleLabel: "RS",
  };
}

/**
 * All non-cancelled duties become candidate group members. The RS-grouping
 * util partitions by schedule + building and chunks by 5, and here we split
 * the resulting groups by whether the schedule's end has passed.
 */
export function normalizeRsGroupsUpcoming({
  duties,
}: {
  duties: readonly Duty[];
}): DashboardDutyItem[] {
  const active = duties.filter((d) => d.status !== "cancelled");
  const groups = groupRSDutiesIntoUpcomingGroups(active);
  return groups
    .filter((g) => isDutyUpcoming(g.date, g.endTime))
    .sort(byGroupAsc)
    .map(rsGroupToItem);
}

export function normalizeRsGroupsCompleted({
  duties,
}: {
  duties: readonly Duty[];
}): DashboardDutyItem[] {
  const nonCancelled = duties.filter((d) => d.status !== "cancelled");
  const groups = groupRSDutiesIntoUpcomingGroups(nonCancelled);
  return groups
    .filter((g) => !isDutyUpcoming(g.date, g.endTime))
    .sort(byGroupDesc)
    .map(rsGroupToItem);
}

function byGroupAsc(a: RSUpcomingGroup, b: RSUpcomingGroup): number {
  const da = new Date(a.date).getTime();
  const db = new Date(b.date).getTime();
  if (da !== db) return da - db;
  return a.startTime.localeCompare(b.startTime);
}

function byGroupDesc(a: RSUpcomingGroup, b: RSUpcomingGroup): number {
  return -byGroupAsc(a, b);
}
