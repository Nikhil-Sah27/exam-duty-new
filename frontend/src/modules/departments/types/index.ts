export interface Department {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export interface DepartmentStats {
  totalStudents: number;
  totalSemesters: number;
  totalCourses: number;
}

export interface Semester {
  _id: string;
  name: string;
  department: string;
  studentCount: number;
  createdAt: string;
}

export interface CourseExams {
  ia1: boolean;
  ia2: boolean;
  ia3: boolean;
  see: boolean;
}

export type CourseType = "core" | "elective";

export interface Course {
  _id: string;
  name: string;
  code: string;
  credits: number;
  semester: string;
  courseType: CourseType;
  electiveGroup: { _id: string; name: string } | string | null;
  exams: CourseExams;
  createdAt: string;
}

export interface ElectiveGroup {
  _id: string;
  name: string;
  semester: string;
  courses: Course[];
  createdAt: string;
}

export interface CreateDepartmentPayload {
  name: string;
  code: string;
}

export interface CreateSemesterPayload {
  name: string;
  department: string;
  studentCount: number;
}

export interface CreateCoursePayload {
  name: string;
  code: string;
  credits: number;
  semester: string;
  exams: CourseExams;
  courseType?: CourseType;
  electiveGroup?: string | null;
}

export interface CreateElectiveGroupPayload {
  name: string;
  semester: string;
}

interface ListResponse<T> {
  success: boolean;
  count: number;
  data: T[];
}

interface SingleResponse<T> {
  success: boolean;
  data: T;
}

export type DepartmentListResponse = ListResponse<Department>;
export type DepartmentResponse = SingleResponse<Department>;
export type DepartmentStatsResponse = SingleResponse<DepartmentStats>;
export type SemesterListResponse = ListResponse<Semester>;
export type SemesterResponse = SingleResponse<Semester>;
export type CourseListResponse = ListResponse<Course>;
export type CourseResponse = SingleResponse<Course>;
export type ElectiveGroupListResponse = ListResponse<ElectiveGroup>;
export type ElectiveGroupResponse = SingleResponse<ElectiveGroup>;
