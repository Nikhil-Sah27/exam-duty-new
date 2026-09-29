export type DutyStatus = "assigned" | "completed" | "cancelled";

/**
 * A Duty references EITHER the legacy `exam` model OR the new
 * `examSchedule` + `examRoom` pair (introduced for the ExamGroup-based flow).
 * Both are populated lazily — consumers should be defensive.
 */
export interface Duty {
  _id: string;
  exam: {
    _id: string;
    name: string;
    date: string;
    department: string;
    semester: number;
    type: string;
  } | null;
  examSchedule: {
    _id: string;
    date: string;
    startTime: string;
    endTime: string;
    examGroup?: {
      _id: string;
      examType: string;
      semester: number;
    };
  } | null;
  examRoom: {
    _id: string;
    departments: string[];
    room?: {
      _id: string;
      roomNumber: string;
      floor: number;
      capacity: number;
      building?: { _id: string; name: string };
    };
  } | null;
  teacher: {
    _id: string;
    name: string;
    email: string;
    department: string;
  };
  /**
   * Which role slot this duty fills. A teacher can hold several roles, so the
   * duty records which one was claimed — used to decide whether to render a
   * duty as part of an RS/DCS group vs. a standalone invigilator row. Optional
   * to stay tolerant of legacy duties created before the field existed.
   */
  role?: "dcs" | "rs" | "invigilator";
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  assignedBy: {
    _id: string;
    name: string;
    email: string;
  };
  isSelfAssigned: boolean;
  status: DutyStatus;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Two acceptable shapes:
 *  - Legacy: { exam, room, date, startTime, endTime }
 *  - New:    { examSchedule, examRoom } — room/date/time derived server-side.
 */
export interface SelfAssignRequest {
  exam?: string;
  examSchedule?: string;
  examRoom?: string;
  room?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export interface AdminAssignRequest extends SelfAssignRequest {
  teacher: string;
}

export interface CancelDutyRequest {
  reason?: string;
}

export interface DutyListResponse {
  success: boolean;
  count: number;
  data: Duty[];
}

export interface DutyResponse {
  success: boolean;
  data: Duty;
}
