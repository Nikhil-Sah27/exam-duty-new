import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/store/auth.store";
import { useDutiesByTeacher } from "@/modules/shared/exams/hooks/useSharedExamData";
import { getRoleConfig } from "@/modules/shared/role-config/roleConfig";
import {
  selectDuty,
  cancelDutySelection,
  type DutySelectionInput,
} from "../services/invigilatorDutyService";
import {
  deriveSelectionState,
  type DutySelectionState,
  type SlotContext,
} from "../utils/dutySelectionUtils";

interface UseDutySelectionResult {
  state: DutySelectionState;
  /** Whether the "Select Duty" mutation is currently running. */
  isSubmitting: boolean;
  /** Whether the cancellation mutation is currently running. */
  isCancelling: boolean;
  /** Last submit error (axios error message), if any. */
  errorMessage: string | null;
  /** Trigger a self-assign for this slot. */
  select: (input: DutySelectionInput) => void;
  /** Cancel a previously selected duty by its Duty._id. */
  cancel: (dutyId: string, reason?: string) => void;
}

/**
 * Hook for a SINGLE slot's selection state and actions.
 *
 * For multi-slot orchestration (the Select Duty page), see
 * @/modules/invigilator/select-duty/hooks/useDutySelection.
 *
 * @param slot         Slot context (date/time/room + invigilatorAssigned flag)
 * @param isPending    Optional pending flag — passed through to state derivation.
 *                     No backend currently produces this; the parameter exists
 *                     so the modal can plumb it the moment a request workflow
 *                     is added.
 */
export function useDutySelection(
  slot: SlotContext,
  isPending: boolean = false
): UseDutySelectionResult {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const dutiesQuery = useDutiesByTeacher(user?.id);
  const myDuties = dutiesQuery.data ?? [];

  // Role-aware "FULL" check: the current user owns this slot iff THEIR role
  // flag is already true. Invigilator → invigilatorAssigned, RS → rsAssigned.
  // Falls back to invigilator for unknown/admin roles so the hook is safe to
  // call from contexts where the user isn't an operational role.
  const config = getRoleConfig(user?.activeRole || undefined);
  const flagKey = config?.flagKey ?? "invigilatorAssigned";
  // Role-scope ownership + conflict: an invigilator duty must not read as the
  // RS slot being "mine", and it MUST clash when picking RS at the same time.
  const viewerRole = config?.roleKey ?? "invigilator";

  const state = deriveSelectionState(slot, myDuties, flagKey, isPending, viewerRole);

  const invalidateSharedExamData = () => {
    queryClient.invalidateQueries({ queryKey: ["shared", "duty-status"] });
    queryClient.invalidateQueries({ queryKey: ["shared", "duties-by-teacher"] });
    // Claiming or cancelling a duty changes the invigilator's completed +
    // remaining counts — refresh the target widget on next render.
    queryClient.invalidateQueries({ queryKey: ["duty-calculation"] });
  };

  const selectMutation = useMutation({
    mutationFn: (input: DutySelectionInput) => selectDuty(input),
    onSettled: invalidateSharedExamData,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ dutyId, reason }: { dutyId: string; reason?: string }) =>
      cancelDutySelection(dutyId, reason),
    onSettled: invalidateSharedExamData,
  });

  const errorMessage =
    selectMutation.error instanceof Error
      ? selectMutation.error.message
      : null;

  return {
    state,
    isSubmitting: selectMutation.isPending,
    isCancelling: cancelMutation.isPending,
    errorMessage,
    select: selectMutation.mutate,
    cancel: (dutyId, reason) => cancelMutation.mutate({ dutyId, reason }),
  };
}
