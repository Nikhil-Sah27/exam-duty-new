// Re-export department types used across CIE workflow
export type { Department, Semester, Course } from "@/modules/departments/types";

// ---------- Config ----------

export type ExamType = "IA1" | "IA2" | "IA3";

export interface Shift {
  name: string;
  startTime: string;
  endTime: string;
}

export interface CIEConfig {
  departmentIds: string[];
  semester: string;
  examType: ExamType;
  avgStudentsPerClass: number;
  shifts: Shift[];
  startDate: string;
  endDate: string;
}

export interface DateCalculation {
  requiredDays: number;
  maxCourses: number;
  totalSlots: number;
  dates: string[];
  skippedSundays: string[];
  endDate: string | null;
}

// ---------- Departments Data (from API) ----------

export interface CourseWithGroup {
  _id: string;
  name: string;
  code: string;
  credits: number;
  courseType?: "core" | "elective";
  electiveGroup?: { _id: string; name: string } | null;
}

export interface ElectiveGroupData {
  _id: string;
  name: string;
}

export interface DepartmentData {
  _id: string;
  name: string;
  code: string;
  semester: {
    _id: string;
    name: string;
    studentCount: number;
  };
  courses: CourseWithGroup[];
  electiveGroups?: ElectiveGroupData[];
}

// ---------- Routine ----------

// assignments[deptId] holds a tagged token — "course:<id>" or "group:<id>".
// A legacy bare courseId is also accepted by the backend for compat.
export interface RoutineEntry {
  date: string;
  shiftIndex: number;
  assignments: Record<string, string>;
}

// ---------- Room Assignment ----------

export interface RoomInfo {
  _id: string;
  roomNumber: string;
  floor: number;
  capacity: number;
  buildingName?: string;
}

export interface BuildingGrouped {
  _id: string;
  name: string;
  floors: Record<number, RoomInfo[]>;
}

// ---------- Seat Sharing ----------

/** Tracks a cross-department seat share within a single room */
export interface SharedSeatAllocation {
  roomId: string;
  roomNumber: string;
  roomCapacity: number;
  buildingName?: string | null;
  ownerDeptId: string;
  ownerDeptCode: string;
  targetDeptId: string;
  targetDeptCode: string;
  sharedStudents: number;
}

/** Unused seat info for the suggestion engine */
export interface UnusedSeatInfo {
  roomId: string;
  roomNumber: string;
  roomCapacity: number;
  availableSeats: number;
  ownerDeptId: string;
  ownerDeptCode: string;
  buildingName?: string;
}

/** A single step in a sharing plan */
export interface SeatSharingPlanItem {
  roomId: string;
  roomNumber: string;
  roomCapacity: number;
  buildingName?: string | null;
  ownerDeptId: string;
  ownerDeptCode: string;
  allocate: number;
}

// ---------- Global Seat Sharing (cross-exam-group) ----------

/**
 * A room that another exam group has explicitly opted into the global sharing
 * pool. Returned by `POST /api/seat-sharing/available`, keyed by slotKey.
 */
export interface ShareableRoomOption {
  examRoomId: string;
  configurationId: string;
  roomId: string;
  roomNumber: string;
  buildingName: string;
  roomCapacity: number;
  remainingSeats: number;
  initialShareableSeats: number;
  sourceExamGroupId: string;
  sourceExamType: string;
  sourceSemester: number;
  sourceDepartmentCodes: string[];
  scheduleId: string;
}

/** Client-side draft: the current dept has borrowed N seats from a shareable room. */
export interface GlobalSharedConsumption {
  examRoomId: string;
  configurationId: string;
  roomId: string;
  roomNumber: string;
  buildingName: string;
  roomCapacity: number;
  sourceExamGroupId: string;
  sourceExamType: string;
  sourceDepartmentCodes: string[];
  studentsAllocated: number;
}

/**
 * Client-side draft: the current dept has marked ONE of its assigned rooms as
 * globally shareable (radio-select). `initialShareableSeats` is the dept's
 * `extra` at the moment of marking.
 */
export interface ShareableRoomMark {
  roomId: string;
  initialShareableSeats: number;
}

/** slotKey → shareable rooms available in that slot */
export type ShareableRoomsBySlot = Map<string, ShareableRoomOption[]>;

/** Per-department allocation within a slot */
export interface DepartmentAllocation {
  departmentId: string;
  departmentCode: string;
  courseId: string;
  courseName: string;
  students: number;
  assignedRooms: RoomInfo[];
  /** Seats this dept receives from other depts' rooms (intra-batch) */
  sharedSeatsReceived: SharedSeatAllocation[];
  /** Seats this dept gives away to other depts from its rooms (intra-batch) */
  sharedSeatsGiven: SharedSeatAllocation[];
  /** Global Seat Sharing: at most one owned room can be marked shareable */
  shareableMark: ShareableRoomMark | null;
  /** Global Seat Sharing: borrowed seats from other exam groups' rooms */
  globalSharedReceived: GlobalSharedConsumption[];
}

/** A single exam slot with per-department room allocations */
export interface SlotAllocation {
  scheduleId: string;
  date: string;
  shiftIndex: number;
  shiftName: string;
  departments: DepartmentAllocation[];
}

/** Global map tracking which rooms are used per slot key (date_shiftIndex) */
export type UsedRoomsMap = Record<string, string[]>;

/**
 * Reservation info returned by `/exam-groups/room-availability`. Represents
 * a room already booked in an overlapping time window by *another* exam.
 * Used to grey out the room in the picker and render the tooltip.
 */
export interface ReservationInfo {
  examRoomId: string;
  examGroupId: string;
  examType: string;
  semester: number;
  departments: string[];
  roomId: string;
  roomNumber: string | null;
  buildingName: string | null;
  date: string;
  startTime: string;
  endTime: string;
}

/** slotKey (YYYY-MM-DD|startTime|endTime) → roomId → ReservationInfo */
export type ReservedRoomsBySlot = Map<string, Map<string, ReservationInfo>>;

/** @deprecated Use SlotAllocation instead */
export interface SlotRoomAssignment {
  scheduleId: string;
  date: string;
  shiftIndex: number;
  shiftName: string;
  totalStudents: number;
  selectedRoomIds: string[];
  selectedCapacity: number;
}

// ---------- API Payloads ----------

export interface CreatePlanPayload {
  examType: ExamType;
  semester: string;
  startDate: string;
  endDate: string;
  shifts: Shift[];
  routine: RoutineEntry[];
}

export interface AssignRoomsPayload {
  assignments: {
    scheduleId: string;
    roomId: string;
    departmentCode: string;
    /** For shared seats: number of students from this dept in this room */
    students?: number;
    isShared?: boolean;
  }[];
}

/**
 * Single-call transactional payload — used by the deferred-write UI. Nothing
 * is persisted to the database until this payload reaches `/cie/finalize`.
 * `scheduleId` inside `roomAssignments` is a *synthetic slot key*
 * (`${date}|${shiftIndex}`); the backend resolves it to a real ExamSchedule
 * _id as it creates the schedules inside the transaction.
 */
export interface FinalizeCIEPayload extends CreatePlanPayload {
  roomAssignments: AssignRoomsPayload["assignments"];
  /** Global Seat Sharing — owner side. `scheduleKey = ${date}|${shiftIndex}`. */
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

// ---------- API Responses ----------

export interface CreateExamsStatusResponse {
  success: boolean;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
