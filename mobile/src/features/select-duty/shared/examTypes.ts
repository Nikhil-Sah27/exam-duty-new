// Copied verbatim from frontend/src/modules/exams/types.ts (the "New Exam Group types"
// and "Duty Status types" sections) — keep in sync. `Duty` is re-exported the same
// way frontend/src/modules/shared/exams/types/exam.types.ts does.

// ── New Exam Group types ──

export type ExamGroupType = "IA1" | "IA2" | "IA3" | "SEE";
export type ExamGroupStatus = "upcoming" | "ongoing" | "completed";

export interface ExamGroup {
  _id: string;
  examType: ExamGroupType;
  semester: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdBy: { _id: string; name: string; email: string };
  totalSchedules: number;
  totalRooms: number;
  /**
   * Distinct department codes involved across every ExamRoom in the group.
   * Populated by `findAllWithStats`; may be omitted on responses from older
   * endpoints that don't run the stats aggregation.
   */
  departments?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * What course(s) are being written in this exam slot. Sourced from
 * CIEPlanEntry on the backend and surfaced as an additive field by
 * `/api/exam-groups/:id/details`. Multi-department schedules carry one
 * entry per (department × course); single-department flows carry one entry.
 */
export interface ScheduleCourse {
  courseId?: string;
  courseCode: string | null;
  courseTitle: string | null;
  credits: number | null;
  courseType: "core" | "elective" | null;
  // When the course belongs to an elective group, the backend returns the
  // group details here so the client can render one collapsed row per group.
  electiveGroupId?: string | null;
  electiveGroupName?: string | null;
  departmentCode: string | null;
  departmentName: string | null;
}

export interface ExamSchedule {
  _id: string;
  examGroup: string;
  date: string;
  startTime: string;
  endTime: string;
  rooms: ExamRoomAssignment[];
  /** Per-(department × course) plan entries for this schedule. Empty when
   *  the plan hasn't been wired (legacy single-exam flow). */
  courses?: ScheduleCourse[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamRoomAssignment {
  _id: string;
  schedule: string;
  room: {
    _id: string;
    roomNumber: string;
    floor: number;
    capacity: number;
    building: {
      _id: string;
      name: string;
    };
  };
  departments: string[];
}

export interface ExamGroupDetails extends ExamGroup {
  schedules: ExamSchedule[];
}

// ── Duty Status types ──

/**
 * Public-facing assignee snapshot. Backend strips password + isActive and
 * only exposes contact-relevant fields so teacher dashboards can show
 * who currently owns each role on a room.
 */
export interface AssigneePublic {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: ("cs" | "dcs" | "rs" | "invigilator")[];
  department: string | null;
  designation: string | null;
}

export interface RoomDutyFlags {
  dcsAssigned: boolean;
  rsAssigned: boolean;
  invigilatorAssigned: boolean;
  /**
   * Populated assignee per role when the slot is filled. Additive — older
   * callers that only read the booleans continue to work unchanged.
   */
  dcsTeacher?: AssigneePublic | null;
  rsTeacher?: AssigneePublic | null;
  invigilatorTeacher?: AssigneePublic | null;
  /** Duty id per filled slot — lets CS unassign from the room view. */
  dcsDutyId?: string | null;
  rsDutyId?: string | null;
  invigilatorDutyId?: string | null;
  /** Has the slot's holder confirmed? Drives the "Awaiting confirmation" badge. */
  dcsConfirmed?: boolean;
  rsConfirmed?: boolean;
  invigilatorConfirmed?: boolean;
}

/** Map of examRoomId → duty flags */
export type DutyStatusMap = Record<string, RoomDutyFlags>;

export type DutyStatus = "NOT_ASSIGNED" | "PARTIAL" | "FULLY_ASSIGNED";

export interface DutyStatusResponse {
  success: boolean;
  data: DutyStatusMap;
}


export type { Duty } from "./dutyTypes";
