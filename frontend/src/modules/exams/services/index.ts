import api from "@/shared/lib/api";
import {
  CreateExamRequest,
  UpdateExamRequest,
  ExamListResponse,
  ExamResponse,
  Exam,
  ExamGroup,
  ExamGroupDetails,
  ExamGroupListResponse,
  ExamGroupResponse,
  ExamGroupDetailsResponse,
  UpdateExamGroupRequest,
  ExamSchedule,
  ExamScheduleResponse,
  CreateScheduleRequest,
  ExamRoomAssignment,
  ExamRoomResponse,
  CreateExamRoomRequest,
  DutyStatusMap,
  DutyStatusResponse,
} from "../types";

// ── Legacy single-exam services ──

export const fetchExams = async (): Promise<Exam[]> => {
  const res = await api.get<ExamListResponse>("/exams");
  return res.data.data;
};

export const fetchExamById = async (id: string): Promise<Exam> => {
  const res = await api.get<ExamResponse>(`/exams/${id}`);
  return res.data.data;
};

export const createExam = async (data: CreateExamRequest): Promise<Exam> => {
  const res = await api.post<ExamResponse>("/exams", data);
  return res.data.data;
};

export const updateExam = async (
  id: string,
  data: UpdateExamRequest
): Promise<Exam> => {
  const res = await api.put<ExamResponse>(`/exams/${id}`, data);
  return res.data.data;
};

export const cancelExam = async (id: string): Promise<void> => {
  await api.patch(`/exams/${id}/cancel`);
};

export const restoreExam = async (id: string): Promise<Exam> => {
  const res = await api.patch<ExamResponse>(`/exams/${id}/restore`);
  return res.data.data;
};

// ── Exam Group services ──

export const fetchExamGroups = async (): Promise<ExamGroup[]> => {
  const res = await api.get<ExamGroupListResponse>("/exam-groups");
  return res.data.data;
};

export const fetchExamGroupDetails = async (
  id: string
): Promise<ExamGroupDetails> => {
  const res = await api.get<ExamGroupDetailsResponse>(
    `/exam-groups/${id}/details`
  );
  return res.data.data;
};

export const updateExamGroup = async (
  id: string,
  data: UpdateExamGroupRequest
): Promise<ExamGroup> => {
  const res = await api.patch<ExamGroupResponse>(`/exam-groups/${id}`, data);
  return res.data.data;
};

export const deleteExamGroup = async (id: string): Promise<void> => {
  await api.delete(`/exam-groups/${id}`);
};

// ── Schedule services ──

export const createSchedule = async (
  data: CreateScheduleRequest
): Promise<ExamSchedule> => {
  const res = await api.post<ExamScheduleResponse>(
    "/exam-groups/schedules",
    data
  );
  return res.data.data;
};

export const deleteSchedule = async (id: string): Promise<void> => {
  await api.delete(`/exam-groups/schedules/${id}`);
};

// ── Exam Room services ──

export const addExamRoom = async (
  data: CreateExamRoomRequest
): Promise<ExamRoomAssignment> => {
  const res = await api.post<ExamRoomResponse>("/exam-groups/rooms", data);
  return res.data.data;
};

export const removeExamRoom = async (id: string): Promise<void> => {
  await api.delete(`/exam-groups/rooms/${id}`);
};

// ── Duty Status services ──

export const fetchExamDutyStatus = async (
  groupId: string
): Promise<DutyStatusMap> => {
  const res = await api.get<DutyStatusResponse>(
    `/exam-groups/${groupId}/duty-status`
  );
  return res.data.data;
};
