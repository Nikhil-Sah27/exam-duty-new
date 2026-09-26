import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useExamDeletionCleanup } from "@/modules/shared/exam-cleanup/hooks/useExamDeletionCleanup";
import {
  fetchExams,
  createExam,
  updateExam,
  cancelExam,
  restoreExam,
  fetchExamGroups,
  fetchExamGroupDetails,
  updateExamGroup,
  deleteExamGroup,
  createSchedule,
  deleteSchedule,
  addExamRoom,
  removeExamRoom,
  fetchExamDutyStatus,
} from "../services";
import {
  CreateExamRequest,
  UpdateExamRequest,
  UpdateExamGroupRequest,
  CreateScheduleRequest,
  CreateExamRoomRequest,
} from "../types";

// ── Legacy hooks ──

const EXAMS_KEY = ["exams"];

export const useExams = () => {
  return useQuery({
    queryKey: EXAMS_KEY,
    queryFn: fetchExams,
  });
};

export const useCreateExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExamRequest) => createExam(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXAMS_KEY });
    },
  });
};

export const useUpdateExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExamRequest }) =>
      updateExam(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXAMS_KEY });
    },
  });
};

export const useCancelExam = () => {
  const { invalidateAll } = useExamDeletionCleanup();
  return useMutation({
    mutationFn: (id: string) => cancelExam(id),
    onSuccess: () => {
      // Legacy single-Exam cancel runs the same cascade on the backend
      // (release duties, cancel change requests, notify, audit) — so the
      // frontend has to refresh the same wide set of caches.
      invalidateAll();
    },
  });
};

export const useRestoreExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreExam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXAMS_KEY });
    },
  });
};

// ── Exam Group hooks ──

const EXAM_GROUPS_KEY = ["exam-groups"];
const examGroupDetailsKey = (id: string) => ["exam-groups", id, "details"];

export const useExamGroups = () => {
  return useQuery({
    queryKey: EXAM_GROUPS_KEY,
    queryFn: fetchExamGroups,
  });
};

export const useExamGroupDetails = (id: string) => {
  return useQuery({
    queryKey: examGroupDetailsKey(id),
    queryFn: () => fetchExamGroupDetails(id),
    enabled: !!id,
  });
};

export const useUpdateExamGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateExamGroupRequest;
    }) => updateExamGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXAM_GROUPS_KEY });
    },
  });
};

export const useDeleteExamGroup = () => {
  const { invalidateAll } = useExamDeletionCleanup();
  return useMutation({
    mutationFn: (id: string) => deleteExamGroup(id),
    onSuccess: () => {
      // Backend cascade releases duties + cancels change requests + emits
      // notifications. Refresh every cache that could be holding stale views.
      invalidateAll();
    },
  });
};

// ── Schedule hooks ──

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateScheduleRequest) => createSchedule(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: examGroupDetailsKey(variables.examGroup),
      });
      queryClient.invalidateQueries({ queryKey: EXAM_GROUPS_KEY });
    },
  });
};

export const useDeleteSchedule = (examGroupId: string) => {
  const queryClient = useQueryClient();
  const { invalidateAll } = useExamDeletionCleanup();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: examGroupDetailsKey(examGroupId),
      });
      // Backend cascade — release duties, cancel change requests, notify.
      invalidateAll();
    },
  });
};

// ── Duty Status hooks ──

const dutyStatusKey = (id: string) => ["exam-groups", id, "duty-status"];

export const useExamDutyStatus = (groupId: string) => {
  return useQuery({
    queryKey: dutyStatusKey(groupId),
    queryFn: () => fetchExamDutyStatus(groupId),
    enabled: !!groupId,
  });
};

// ── Exam Room hooks ──

export const useAddExamRoom = (examGroupId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExamRoomRequest) => addExamRoom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: examGroupDetailsKey(examGroupId),
      });
      queryClient.invalidateQueries({ queryKey: EXAM_GROUPS_KEY });
    },
  });
};

export const useRemoveExamRoom = (examGroupId: string) => {
  const queryClient = useQueryClient();
  const { invalidateAll } = useExamDeletionCleanup();
  return useMutation({
    mutationFn: (id: string) => removeExamRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: examGroupDetailsKey(examGroupId),
      });
      // Backend cascade — release duties, cancel change requests, notify.
      invalidateAll();
    },
  });
};
