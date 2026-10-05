import { UserRole } from "@/shared/lib/types";

export interface Teacher {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: UserRole[];
  department: string | null;
  designation: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Populated exam-schedule ref returned by the backend when a duty was created
 * via the new ExamGroup / ExamSchedule / ExamRoom flow. Legacy duties (from
 * the older single-Exam controller path) have this as null; new duties have
 * `exam: null` and populate this instead.
 */
export interface TeacherDutyExamSchedule {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  examGroup: {
    _id: string;
    examType: "IA1" | "IA2" | "IA3" | "SEE";
    semester: number;
  } | null;
}

export interface TeacherDutyExamRoom {
  _id: string;
  departments: string[];
  room: {
    _id: string;
    roomNumber: string;
    floor: number;
    capacity: number;
    building: { _id: string; name: string } | null;
  } | null;
}

export interface TeacherDuty {
  _id: string;
  /** Legacy exam ref — null for duties created via the ExamGroup flow. */
  exam: {
    _id: string;
    name: string;
    date: string;
    department: string;
    semester: number;
    type: string;
  } | null;
  /** New-flow refs — null for legacy duties. */
  examSchedule: TeacherDutyExamSchedule | null;
  examRoom: TeacherDutyExamRoom | null;
  teacher: {
    _id: string;
    name: string;
    email: string;
    department: string;
  };
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
  status: "assigned" | "completed" | "cancelled";
  createdAt: string;
}

export interface TeacherWithStats extends Teacher {
  dutyStats: {
    completed: number;
    remaining: number;
    target: number;
  };
}

export interface TeacherFilters {
  search: string;
  department: string;
  role: string;
}
