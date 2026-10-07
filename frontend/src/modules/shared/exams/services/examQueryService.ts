import api from "@/shared/lib/api";
import type {
  ExamGroup,
  ExamGroupDetails,
  DutyStatusMap,
  Duty,
} from "../types/exam.types";

interface ApiList<T> {
  success: boolean;
  count?: number;
  data: T[];
}
interface ApiSingle<T> {
  success: boolean;
  data: T;
}

/**
 * Shared read-only query layer for exam data.
 *
 * Hits the same backend endpoints used by the Controller's mutating service —
 * data is single-source. Mutations stay in `modules/exams/services/examService.ts`
 * (Controller-only). Reads live here so Invigilator and Controller can both
 * consume the same code path.
 */

export const fetchExamGroups = async (): Promise<ExamGroup[]> => {
  const res = await api.get<ApiList<ExamGroup>>("/exam-groups");
  return res.data.data;
};

export const fetchExamGroupDetails = async (
  id: string
): Promise<ExamGroupDetails> => {
  const res = await api.get<ApiSingle<ExamGroupDetails>>(
    `/exam-groups/${id}/details`
  );
  return res.data.data;
};

export const fetchExamDutyStatus = async (
  groupId: string
): Promise<DutyStatusMap> => {
  const res = await api.get<ApiSingle<DutyStatusMap>>(
    `/exam-groups/${groupId}/duty-status`
  );
  return res.data.data;
};

export const fetchDutiesByTeacher = async (
  teacherId: string,
  role?: string
): Promise<Duty[]> => {
  const res = await api.get<ApiList<Duty>>("/duties", {
    // `role` scopes a multi-role teacher's duties to one dashboard. Omitted by
    // CS views, which want every role.
    params: role ? { teacher: teacherId, role } : { teacher: teacherId },
  });
  return res.data.data;
};
