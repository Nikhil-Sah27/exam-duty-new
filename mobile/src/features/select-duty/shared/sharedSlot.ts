import type { DcsGroup } from "./dcsTypes";
import type { RSDutyGroup } from "./rsTypes";

/**
 * Which exams a group belongs to. SEE departments writing at the same time
 * share one schedule, so one RS chunk can mix several departments' rooms, and
 * a shared slot's DCS groups belong to its owner exam while the departments
 * that joined it are listed in `schedule.sharedWith`. Every per-exam view
 * (Select Duty home counts, an exam's RS / DCS lists) asks these — never the
 * first room's or the owner's exam alone.
 */
export const rsGroupExamIds = (group: RSDutyGroup): string[] => [
  ...new Set(group.rooms.map((r) => r.examGroupId)),
];

export const dcsGroupExamIds = (group: DcsGroup): string[] => [
  ...new Set([group.examGroup?._id, ...(group.schedule.sharedWith ?? [])].filter((id): id is string => !!id)),
];
