import api from "@/shared/lib/api";
import { Teacher, TeacherDuty } from "../types";
import type { UserRole } from "@/shared/lib/types";

interface ListResponse<T> {
  success: boolean;
  count: number;
  data: T[];
}

interface SingleResponse<T> {
  success: boolean;
  data: T;
}

export const getTeachers = async (): Promise<Teacher[]> => {
  const res = await api.get<ListResponse<Teacher>>("/users");
  return res.data.data;
};

export const getTeacherById = async (id: string): Promise<Teacher> => {
  const res = await api.get<SingleResponse<Teacher>>(`/users/${id}`);
  return res.data.data;
};

/**
 * Teachers eligible for a given duty role. Reuses the same centralized
 * eligibility rule as the rest of the app: `GET /users?role=<role>` returns
 * active users whose `roles` array contains that role, and `roles` is derived
 * from designation via the backend's single roleResolver (HOD/Dean → dcs,
 * Professor/Associate/Assistant → rs, Associate/Assistant → invigilator).
 * No CS-specific eligibility logic is introduced.
 */
export const getEligibleTeachers = async (
  role: Exclude<UserRole, "cs">
): Promise<Teacher[]> => {
  const res = await api.get<ListResponse<Teacher>>("/users", {
    params: { role },
  });
  return res.data.data;
};

export const getTeacherDuties = async (teacherId: string): Promise<TeacherDuty[]> => {
  const res = await api.get<ListResponse<TeacherDuty>>("/duties", {
    params: { teacher: teacherId },
  });
  return res.data.data;
};

/**
 * Assign-duty shape used by the visual CS workflow: pick a real
 * ExamSchedule + ExamRoom pair instead of manually typed room/date/time
 * strings. Backend service resolves room/date/times from the refs.
 */
export interface AssignByScheduleSlotPayload {
  examSchedule: string;
  examRoom: string;
  teacher: string;
  /**
   * Optional explicit role slot. The invigilator wizard omits it (single-role
   * teachers infer server-side). The CS room-detail flow always passes
   * `"invigilator"` so multi-role teachers (e.g. Associate Professors who are
   * both RS and invigilator) resolve unambiguously.
   */
  role?: Exclude<UserRole, "cs">;
}

export const assignDutyBySlot = async (
  data: AssignByScheduleSlotPayload
): Promise<TeacherDuty> => {
  const res = await api.post<SingleResponse<TeacherDuty>>(
    "/duties/admin-assign",
    data
  );
  return res.data.data;
};

/**
 * CS admin-assigns an RS group (a chunk of ≤5 rooms in the same building +
 * schedule) to one teacher. Reuses the backend's transactional
 * `admin-assign-group` path (one Duty per room, all-or-nothing, one
 * `duty_assigned` notification per room). RS groups aren't persisted — the
 * caller supplies the concrete `examRooms` derived from the same grouping
 * util the RS dashboard uses.
 */
export interface AssignGroupPayload {
  teacher: string;
  examSchedule: string;
  examRooms: string[];
  role: "rs";
}

export const assignRSGroup = async (
  data: AssignGroupPayload
): Promise<TeacherDuty[]> => {
  const res = await api.post<ListResponse<TeacherDuty>>(
    "/duties/admin-assign-group",
    data
  );
  return res.data.data;
};
