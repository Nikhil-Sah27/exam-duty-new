// Shared API types. Mirrors frontend/src/shared/lib/types.ts — keep in step.

export type UserRole = "superadmin" | "cs" | "dcs" | "rs" | "invigilator";

/** Roles the phone app serves. CS and the platform superadmin use the website. */
export type TeacherRole = Exclude<UserRole, "cs" | "superadmin">;

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  roles: UserRole[];
  activeRole: UserRole | null;
}

/** Every backend response is `{ success, data }`; errors are thrown as Error(message) by api.ts. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  count?: number;
}

export interface LoginResult {
  user: User;
  token: string | null;
  tempToken: string | null;
  requiresRoleSelection: boolean;
}

/**
 * One live upcoming duty UNIT for the signed-in teacher (GET /api/duties/my-units).
 * An RS/DCS group is ONE unit covering several rooms; an invigilator duty is one room.
 * startsAt/endsAt are exact UTC instants — the phone needs no timezone logic.
 */
export interface DutyUnit {
  key: string;
  role: TeacherRole;
  dutyIds: string[];
  primaryDutyId: string;
  examScheduleId: string | null;
  examLabel: string;
  examType: string | null;
  semester: number | null;
  date: string;
  startTime: string;
  endTime: string;
  startsAt: string;
  endsAt: string;
  building: string | null;
  rooms: string[];
  location: string;
  confirmed: boolean;
  confirmedAt: string | null;
}
