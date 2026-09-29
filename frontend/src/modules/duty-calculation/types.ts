/**
 * Shape of every payload returned by `/api/duty-calculation/*`.  Kept flat
 * and free of Mongoose specifics so both the dashboard widget and the admin
 * analytics table can consume the same types.
 */

export interface DutyCalculationBreakdown {
  totalDuties: number;
  eligibleTeachers: number;
  avgClassroomCapacity: number;
  // Present since the assistant/associate 70/30 split was introduced. Older
  // callers can ignore these — target/completed/remaining still tell the
  // whole per-teacher story.
  assistantCount?: number;
  associateCount?: number;
  assistantBase?: number;
  associateBase?: number;
  // Present only on the RS progress payload (`/my-rs-progress`). The RS split
  // is Professor (base, x) + Associate Professor (0.7x), and `totalDuties` is
  // already the RS figure (invigilator total / 5).
  totalInvigilatorDuties?: number;
  professorCount?: number;
  professorBase?: number;
}

export interface TeacherDutyProgress {
  teacherId: string;
  name: string;
  email: string;
  department: string | null;
  designation: string | null;
  role: "cs" | "dcs" | "rs" | "invigilator";
  eligible: boolean;
  target: number;
  completed: number;
  /**
   * Active duties/groups occupying a target slot — upcoming + ongoing +
   * completed (everything except cancelled). Drives the "target reached" gate,
   * distinct from `completed` (which only counts duties whose time has passed).
   */
  assigned: number;
  /** True once `assigned >= target` (and target > 0) — CS assignment is blocked. */
  reached: boolean;
  remaining: number;
  percentage: number;
  breakdown: DutyCalculationBreakdown;
}

export interface SemesterDutySummary {
  semesterId: string;
  semesterName: string;
  department: string;
  duties: number;
  breakdown: {
    courses: number;
    students: number;
    examTypes: number;
    avgClassroomCapacity: number;
  };
}

export interface DepartmentDutySummary {
  departmentId: string;
  code: string;
  name: string;
  total: number;
  semesters: SemesterDutySummary[];
}

export interface InstitutionDutySummary {
  total: number;
  avgClassroomCapacity: number;
  departments: DepartmentDutySummary[];
}

export interface PerInvigilatorSummary {
  target: number;
  totalDuties: number;
  eligibleTeachers: number;
  avgClassroomCapacity: number;
}

export interface InstitutionSnapshot {
  institution: InstitutionDutySummary;
  perInvigilator: PerInvigilatorSummary;
}

export interface AllTeachersProgressResponse {
  perInvigilator: PerInvigilatorSummary;
  teachers: TeacherDutyProgress[];
}
