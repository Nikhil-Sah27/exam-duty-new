import type { Duty } from "@/modules/duties/types";
import { groupRSDutiesIntoUpcomingGroups } from "@/modules/rs/upcoming-duties/utils/rsUpcomingGrouping";

export interface DutyUnitStats {
  active: number;
  completed: number;
  total: number;
}

/**
 * Distinct DCS groups among a teacher's role-dcs duties of a given status. A DCS
 * group belongs to one schedule and a teacher holds at most one group per
 * schedule, so the number of distinct schedule ids equals the group count.
 */
function countDcsGroups(duties: Duty[], status: Duty["status"]): number {
  const schedules = new Set<string>();
  for (const d of duties) {
    if (d.role !== "dcs" || d.status !== status) continue;
    schedules.add(d.examSchedule?._id ?? `legacy:${d._id}`);
  }
  return schedules.size;
}

/** RS room-groups (chunks of ≤5 per schedule+building) of a given status. */
function countRsGroups(duties: Duty[], status: Duty["status"]): number {
  return groupRSDutiesIntoUpcomingGroups(
    duties.filter((d) => d.role === "rs" && d.status === status),
  ).length;
}

/**
 * Duty counts with RS and DCS collapsed to ONE unit per room-group — RS as
 * chunks of ≤5 rooms per schedule+building, DCS as one group per schedule —
 * while invigilator duties count per room. Cancelled duties are excluded.
 *
 * Shared by the Manage Duties teacher list and the teacher detail stat tiles so
 * a group role never shows one duty per class; a 5-room RS group reads as 1.
 */
export function countDutyUnits(duties: Duty[]): DutyUnitStats {
  const live = duties.filter((d) => d.status !== "cancelled");
  const invig = live.filter((d) => d.role !== "rs" && d.role !== "dcs");

  const active =
    invig.filter((d) => d.status === "assigned").length +
    countRsGroups(live, "assigned") +
    countDcsGroups(live, "assigned");
  const completed =
    invig.filter((d) => d.status === "completed").length +
    countRsGroups(live, "completed") +
    countDcsGroups(live, "completed");

  return { active, completed, total: active + completed };
}
