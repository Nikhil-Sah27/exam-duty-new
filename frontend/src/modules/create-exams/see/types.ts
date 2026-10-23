import type { DepartmentData } from "../types";

/**
 * One scheduled course in the SEE routine being built. The course reference
 * is stored as the full Course shape so the preview list can show code/title
 * without re-querying. Each entry is tagged with the owning department so the
 * multi-department flow can keep CSE's courses/rooms entirely separate from
 * ME's — one exam card is created per department.
 */
export interface SEERoutineEntry {
  /** Stable client-side id so list reorders/edits don't desync. Globally unique. */
  localId: string;
  departmentId: string;
  departmentCode: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  date: string;
  startTime: string;
  endTime: string;
}

/** Payload for POST /create-exams/see/plan */
export interface SEEPlanPayload {
  departmentId: string;
  semester: string;
  schedules: {
    courseId: string;
    date: string;
    startTime: string;
    endTime: string;
  }[];
}

/** Server response — extends ExamGroup with a courseId → scheduleId mapping. */
export interface SEEPlanResponse {
  _id: string;
  examType: "SEE";
  semester: number;
  startDate: string;
  endDate: string;
  scheduleMapping: Record<string, string>;
}

/**
 * One department's slice of the single-call transactional payload. Each
 * schedule's `slotKey` is the routine entry's `localId` (globally unique across
 * departments); room assignments reference that same key so the backend can
 * resolve (slotKey → ExamSchedule._id) atomically inside the finalize
 * transaction.
 */
export interface SEEDepartmentPlan {
  departmentId: string;
  schedules: {
    slotKey: string;
    // Backend accepts either a bare courseId (legacy) or a tagged courseToken
    // like "course:<id>" or "group:<electiveGroupId>" — group tokens fan out
    // to every member course on the server.
    courseId?: string;
    courseToken?: string;
    date: string;
    startTime: string;
    endTime: string;
  }[];
  roomAssignments: {
    scheduleId: string; // slotKey
    roomId: string;
    departmentCode: string;
    students?: number;
    isShared?: boolean;
  }[];
  /** Global Seat Sharing — owner side. */
  shareableRoomMarks?: {
    scheduleKey: string;
    roomId: string;
    departmentCode: string;
    initialShareableSeats: number;
  }[];
  /** Global Seat Sharing — consumer side. */
  globalSharedConsumptions?: {
    scheduleKey: string;
    sourceExamRoomId: string;
    departmentCode: string;
    studentsAllocated: number;
  }[];
}

/**
 * Single-call transactional payload — used by the deferred-write SEE UI.
 * Creates one ExamGroup (and one exam card) per department. Nothing is
 * persisted until this reaches `/see/finalize`.
 */
export interface FinalizeSEEPayload {
  semester: string;
  departments: SEEDepartmentPlan[];
}

/** Re-export so consumers in /see can import everything from this module. */
export type { DepartmentData };
