import api from "@/shared/lib/api";
import type {
  AllTeachersProgressResponse,
  DepartmentDutySummary,
  InstitutionSnapshot,
  SemesterDutySummary,
  TeacherDutyProgress,
} from "../types";

interface ApiSingle<T> {
  success: boolean;
  data: T;
}
interface ApiListWrapper<T> {
  success: boolean;
  count: number;
  data: T;
}

/**
 * Thin wrapper over `/api/duty-calculation/*`.  All computations run server
 * side — this file exists purely to type the responses.
 */

export const fetchMyDutyProgress = async (): Promise<TeacherDutyProgress> => {
  const res = await api.get<ApiSingle<TeacherDutyProgress>>(
    "/duty-calculation/my-progress"
  );
  return res.data.data;
};

export const fetchMyRsDutyProgress = async (): Promise<TeacherDutyProgress> => {
  const res = await api.get<ApiSingle<TeacherDutyProgress>>(
    "/duty-calculation/my-rs-progress"
  );
  return res.data.data;
};

export const fetchMyDcsDutyProgress = async (): Promise<TeacherDutyProgress> => {
  const res = await api.get<ApiSingle<TeacherDutyProgress>>(
    "/duty-calculation/my-dcs-progress"
  );
  return res.data.data;
};

export const fetchTeacherDutyProgress = async (
  teacherId: string
): Promise<TeacherDutyProgress> => {
  const res = await api.get<ApiSingle<TeacherDutyProgress>>(
    `/duty-calculation/teacher/${teacherId}/progress`
  );
  return res.data.data;
};

export const fetchTeacherRsDutyProgress = async (
  teacherId: string
): Promise<TeacherDutyProgress> => {
  const res = await api.get<ApiSingle<TeacherDutyProgress>>(
    `/duty-calculation/teacher/${teacherId}/rs-progress`
  );
  return res.data.data;
};

export const fetchTeacherDcsDutyProgress = async (
  teacherId: string
): Promise<TeacherDutyProgress> => {
  const res = await api.get<ApiSingle<TeacherDutyProgress>>(
    `/duty-calculation/teacher/${teacherId}/dcs-progress`
  );
  return res.data.data;
};

export interface AllTeachersFilters {
  role?: "cs" | "dcs" | "rs" | "invigilator";
  department?: string;
  eligibleOnly?: boolean;
}

export const fetchAllTeachersProgress = async (
  filters: AllTeachersFilters = {}
): Promise<AllTeachersProgressResponse> => {
  const res = await api.get<ApiListWrapper<AllTeachersProgressResponse>>(
    "/duty-calculation/all-teachers",
    { params: filters }
  );
  return res.data.data;
};

export const fetchInstitutionDutySummary =
  async (): Promise<InstitutionSnapshot> => {
    const res = await api.get<ApiSingle<InstitutionSnapshot>>(
      "/duty-calculation/institution"
    );
    return res.data.data;
  };

export const fetchSemesterBreakdown = async (
  semesterId: string
): Promise<SemesterDutySummary> => {
  const res = await api.get<ApiSingle<SemesterDutySummary>>(
    `/duty-calculation/semester/${semesterId}`
  );
  return res.data.data;
};

export const fetchDepartmentBreakdown = async (
  departmentId: string
): Promise<DepartmentDutySummary> => {
  const res = await api.get<ApiSingle<DepartmentDutySummary>>(
    `/duty-calculation/department/${departmentId}`
  );
  return res.data.data;
};
