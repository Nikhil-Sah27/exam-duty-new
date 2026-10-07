import api from "@/lib/api";
import type { TeacherRole } from "@/lib/types";

import type { DcsGroup } from "./shared/dcsTypes";
import type { Duty } from "./shared/dutyTypes";
import type { DutyStatusMap, ExamGroup, ExamGroupDetails } from "./shared/examTypes";

// Same endpoints, params and bodies as the web Select Duty flows:
//   frontend/src/modules/shared/exams/services/examQueryService.ts
//   frontend/src/modules/invigilator/duties/services/invigilatorDutyService.ts
//   frontend/src/modules/rs/select-duty/services/rsDutyService.ts
//   frontend/src/modules/dcs/select-duty/services/dcsDutyService.ts
//   frontend/src/modules/duty-calculation/services/dutyCalculationApi.ts

interface Envelope<T> {
  success: boolean;
  count?: number;
  data: T;
}

// ── Reads ────────────────────────────────────────────────────────────────

export const fetchExamGroups = async (): Promise<ExamGroup[]> => {
  const res = await api.get<Envelope<ExamGroup[]>>("/exam-groups");
  return res.data.data;
};

export const fetchExamGroupDetails = async (id: string): Promise<ExamGroupDetails> => {
  const res = await api.get<Envelope<ExamGroupDetails>>(`/exam-groups/${id}/details`);
  return res.data.data;
};

export const fetchExamDutyStatus = async (groupId: string): Promise<DutyStatusMap> => {
  const res = await api.get<Envelope<DutyStatusMap>>(`/exam-groups/${groupId}/duty-status`);
  return res.data.data;
};

/** Every role's duties — Select Duty's conflict scan wants all of them (web passes no role). */
export const fetchDutiesByTeacher = async (teacherId: string): Promise<Duty[]> => {
  const res = await api.get<Envelope<Duty[]>>("/duties", { params: { teacher: teacherId } });
  return res.data.data;
};

/** All DCS groups (open + claimed) so claimed ones can render as Occupied / Yours. */
export const listDcsGroups = async (): Promise<DcsGroup[]> => {
  const res = await api.get<Envelope<DcsGroup[]>>("/dcs/groups");
  return res.data.data;
};

/** Mirrors TeacherDutyProgress in frontend/src/modules/duty-calculation/types.ts (fields used here). */
export interface DutyProgress {
  role: "cs" | "dcs" | "rs" | "invigilator";
  eligible: boolean;
  target: number;
  completed: number;
  assigned: number;
  reached: boolean;
  remaining: number;
  percentage: number;
}

const PROGRESS_PATH: Record<TeacherRole, string> = {
  invigilator: "/duty-calculation/my-progress",
  rs: "/duty-calculation/my-rs-progress",
  dcs: "/duty-calculation/my-dcs-progress",
};

export const fetchMyProgress = async (role: TeacherRole): Promise<DutyProgress> => {
  const res = await api.get<Envelope<DutyProgress>>(PROGRESS_PATH[role]);
  return res.data.data;
};

// ── Claims ───────────────────────────────────────────────────────────────

/** Invigilator: one room. Backend resolves room/date/time from the two ids. */
export const selectDuty = async (input: { examScheduleId: string; examRoomId: string }): Promise<Duty> => {
  const res = await api.post<Envelope<Duty>>("/duties/self-assign", {
    examSchedule: input.examScheduleId,
    examRoom: input.examRoomId,
  });
  return res.data.data;
};

/** RS: one derived group — all rooms or none (transactional on the backend). */
export const selectRSDutyGroup = async (input: {
  examScheduleId: string;
  examRoomIds: string[];
}): Promise<Duty[]> => {
  const res = await api.post<Envelope<Duty[]>>("/duties/self-assign-group", {
    examSchedule: input.examScheduleId,
    examRooms: input.examRoomIds,
  });
  return res.data.data;
};

/** DCS: claim one persisted DCSGroup. */
export const claimDcsGroup = async (id: string): Promise<DcsGroup> => {
  const res = await api.post<Envelope<DcsGroup>>(`/dcs/groups/${id}/claim`);
  return res.data.data;
};
