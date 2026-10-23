// Port of frontend/src/modules/shared/change-requests/types/changeRequest.types.ts —
// keep in sync. Shapes follow backend/modules/change-request/changeRequest.repository.js
// (POPULATE_DEEP), which GET /change-requests/mine returns.

export type ChangeRequestType = "swap" | "drop" | "move" | "dcs_swap" | "rs_swap";
export type ChangeRequestScope = "duty" | "dcs_group" | "rs_group";
/** The model also has `cancelled_exam_deleted` (exam-cleanup cascade); the web types omit it. */
export type ChangeRequestStatus = "pending" | "approved" | "rejected" | "cancelled_exam_deleted";

export interface ChangeRequestUser {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  department?: string;
}

export interface ChangeRequestDuty {
  _id: string;
  room: string;
  /** roomRef → Room (+ building) — lets the card show "Building — Room". */
  roomRef?: {
    _id: string;
    roomNumber: string;
    building?: { _id: string; name: string };
  } | null;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  teacher?: string;
  role?: "dcs" | "rs" | "invigilator";
  exam?: {
    _id: string;
    name: string;
    department?: string;
  } | null;
}

export interface RequestedScheduleRef {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  examGroup?: {
    _id: string;
    examType: string;
    semester: number;
  };
}

interface RoomRef {
  _id: string;
  roomNumber: string;
  floor: number;
  capacity: number;
  building?: { _id: string; name: string };
}

export interface RequestedExamRoomRef {
  _id: string;
  departments: string[];
  room?: RoomRef;
}

/** Populated DCSGroup on a ChangeRequest (changeRequest.repository DCS_GROUP_POPULATE). */
export interface DcsGroupRef {
  _id: string;
  groupIndex: number;
  dcsRequired: number;
  status: "open" | "claimed" | "released";
  assignedDepartments: string[];
  assignedStudents: number;
  examGroup: {
    _id: string;
    examType: string;
    semester: number;
  } | null;
  schedule: {
    _id: string;
    date: string;
    startTime: string;
    endTime: string;
  };
  assignedRooms: {
    _id: string;
    departments: string[];
    room: RoomRef;
  }[];
  assignedTeacher: {
    _id: string;
    name: string;
    email: string;
    phone?: string | null;
    department?: string | null;
  } | null;
}

/** Populated Duty for the RS source-group snapshot. */
export interface RsSourceDutyRef {
  _id: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  examSchedule: RequestedScheduleRef | null;
  examRoom: RequestedExamRoomRef | null;
}

/** Populated ExamRoom for the RS target-group snapshot. */
export interface RsTargetExamRoomRef {
  _id: string;
  departments: string[];
  room?: RoomRef;
  schedule?: RequestedScheduleRef;
}

export interface ChangeRequest {
  _id: string;
  scope?: ChangeRequestScope;
  /** Non-null for per-duty (invigilator) requests. Null for group swaps. */
  duty: ChangeRequestDuty | null;
  requestedBy: ChangeRequestUser;
  type: ChangeRequestType;
  reason: string;
  swapWith: ChangeRequestUser | null;
  /** Move-request target — populated only when type === "move". */
  requestedSchedule: RequestedScheduleRef | null;
  requestedExamRoom: RequestedExamRoomRef | null;
  requestedRoom: string | null;
  requestedDate: string | null;
  requestedStartTime: string | null;
  requestedEndTime: string | null;
  /** DCS scope — populated only when type === "dcs_swap". */
  dcsSourceGroup: DcsGroupRef | null;
  dcsTargetGroup: DcsGroupRef | null;
  /** RS scope — populated only when type === "rs_swap". */
  rsSourceDuties?: RsSourceDutyRef[];
  rsTargetExamRooms?: RsTargetExamRoomRef[];
  rsSourceKey?: string | null;
  rsTargetKey?: string | null;
  status: ChangeRequestStatus;
  reviewedBy: { _id: string; name: string; email: string } | null;
  reviewedAt: string | null;
  /** CS's note when approving / rejecting. */
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /api/change-requests body. The backend forks on `type`
 * (changeRequest.service submitRequest):
 *  - "move":     duty + requestedSchedule + requestedExamRoom   (invigilator)
 *  - "rs_swap":  rsSourceDuties + rsTargetExamRooms + rsSourceKey + rsTargetKey
 *  - "dcs_swap": dcsSourceGroup + dcsTargetGroup
 * `reason` is required by the model on every type.
 */
export type CreateChangeRequestPayload =
  | {
      type: "move";
      duty: string;
      reason: string;
      requestedSchedule: string;
      requestedExamRoom: string;
    }
  | {
      type: "rs_swap";
      reason: string;
      rsSourceDuties: string[];
      rsTargetExamRooms: string[];
      rsSourceKey: string;
      rsTargetKey: string;
    }
  | {
      type: "dcs_swap";
      reason: string;
      dcsSourceGroup: string;
      dcsTargetGroup: string;
    };

/** A replacement slot returned by GET /change-requests/replacements/:dutyId. */
export interface ReplacementSlot {
  scheduleId: string;
  examRoomId: string;
  examGroupId: string;
  examType: string;
  semester: number;
  date: string;
  startTime: string;
  endTime: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  capacity: number;
  buildingName?: string;
  departments: string[];
}

/** The web's "No reason provided." fallback — the model requires a reason. */
export const DEFAULT_REASON = "No reason provided.";
