import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  getTeachers,
  getTeacherById,
  getTeacherDuties,
  getEligibleTeachers,
  assignDutyBySlot,
  assignRSGroup,
  type AssignByScheduleSlotPayload,
  type AssignGroupPayload,
} from "../services";
import { adminClaimDcsGroup } from "@/modules/dcs/select-duty/services/dcsDutyService";
import { DUTY_CALC_ROOT } from "@/modules/duty-calculation/hooks/useDutyProgress";
import type { UserRole } from "@/shared/lib/types";

const TEACHERS_KEY = ["manage-duties", "teachers"];
const teacherDetailKey = (id: string) => ["manage-duties", "teacher", id];
const teacherDutiesKey = (id: string) => ["manage-duties", "duties", id];
const eligibleTeachersKey = (role: string) => [
  "manage-duties",
  "eligible-teachers",
  role,
];

/**
 * Every duty a CS assigns produces the SAME underlying Duty record a teacher
 * would create by claiming — so it must refresh the exact same caches so the
 * room/group flips to occupied everywhere at once:
 *  - `exam-groups` + `shared`: the two duty-status maps the CS Exams timetable
 *    and the RS/DCS derived-group views read from.
 *  - `dcs/groups`: the persistent DCS group list (status → claimed).
 *  - `duties` + `manage-duties`: teacher duty lists and the teachers table.
 *  - duty-calculation progress tiles.
 */
const invalidateAfterAssign = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ["exam-groups"] });
  queryClient.invalidateQueries({ queryKey: ["shared"] });
  queryClient.invalidateQueries({ queryKey: ["dcs", "groups"] });
  queryClient.invalidateQueries({ queryKey: ["duties"] });
  queryClient.invalidateQueries({ queryKey: ["manage-duties"] });
  queryClient.invalidateQueries({ queryKey: DUTY_CALC_ROOT });
};

export const useTeachers = () => {
  return useQuery({
    queryKey: TEACHERS_KEY,
    queryFn: getTeachers,
  });
};

export const useTeacherDetails = (id: string) => {
  return useQuery({
    queryKey: teacherDetailKey(id),
    queryFn: () => getTeacherById(id),
    enabled: !!id,
  });
};

export const useTeacherDuties = (teacherId: string) => {
  return useQuery({
    queryKey: teacherDutiesKey(teacherId),
    queryFn: () => getTeacherDuties(teacherId),
    enabled: !!teacherId,
  });
};

/**
 * Mutation for the visual CS workflow — takes an ExamSchedule + ExamRoom
 * pair. Invalidates duty caches, exam-group duty-status maps (so the room
 * dot flips from red to green immediately), and duty-calculation progress
 * (so the teacher's Assigned/Remaining tiles refresh).
 */
export const useAssignDutyBySlot = (teacherId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssignByScheduleSlotPayload) => assignDutyBySlot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teacherDutiesKey(teacherId) });
      queryClient.invalidateQueries({ queryKey: TEACHERS_KEY });
      queryClient.invalidateQueries({ queryKey: ["duties"] });
      queryClient.invalidateQueries({ queryKey: ["exam-groups"] });
      queryClient.invalidateQueries({ queryKey: DUTY_CALC_ROOT });
    },
  });
};

// ── CS room-detail assignment (Exams → classroom → assign) ──

/**
 * Eligible teachers for a duty role, backed by the centralized `role` filter
 * on `GET /users`. Cached per role so re-opening the modal is instant.
 */
export const useEligibleTeachers = (role: Exclude<UserRole, "cs"> | null) => {
  return useQuery({
    queryKey: eligibleTeachersKey(role || ""),
    queryFn: () => getEligibleTeachers(role as Exclude<UserRole, "cs">),
    enabled: !!role,
    staleTime: 60_000,
  });
};

/**
 * CS assigns a single invigilator to one classroom. Same `admin-assign`
 * endpoint as the wizard, but always names the role explicitly.
 */
export const useAssignInvigilator = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<AssignByScheduleSlotPayload, "role">) =>
      assignDutyBySlot({ ...data, role: "invigilator" }),
    onSuccess: () => invalidateAfterAssign(queryClient),
  });
};

/** CS assigns a whole RS group (chunk of ≤5 rooms) to one teacher. */
export const useAssignRSGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<AssignGroupPayload, "role">) =>
      assignRSGroup({ ...data, role: "rs" }),
    onSuccess: () => invalidateAfterAssign(queryClient),
  });
};

/** CS assigns a whole DCS group to one teacher via the DCS admin-claim path. */
export const useAdminClaimDcsGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, teacher }: { groupId: string; teacher: string }) =>
      adminClaimDcsGroup(groupId, teacher),
    onSuccess: () => invalidateAfterAssign(queryClient),
  });
};
