import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type RoomAllocationState,
  INITIAL_ROOM_STATE,
  addRoom,
  removeRoom,
  applySharing,
  removeSharing,
  setShareableMark,
  addGlobalShared,
  removeGlobalShared,
} from "../../services/roomAllocationReducer";
import { getRoomWarnings } from "../../selectors/roomAssignSelectors";
import {
  buildAssignRoomsPayload,
  buildShareableMarksPayload,
  buildGlobalConsumptionsPayload,
} from "../../services/payloadBuilders";
import { finalizeSEEExam } from "../services/seeExamService";
import type {
  DepartmentData,
  SlotAllocation,
  RoomInfo,
  SeatSharingPlanItem,
  ShareableRoomMark,
  GlobalSharedConsumption,
} from "../../types";
import type { SEERoutineEntry } from "../types";
import { buildSEESlotAllocations } from "../utils/seeTransformUtils";

/**
 * Drives the SEE room-assignment phase. Reuses the CIE roomAllocationReducer
 * for the slot state machine. The key change vs the old flow: nothing is
 * persisted to the database during this phase — when the user clicks
 * "Finish & Create Exam" we ship the entire draft (config + routine +
 * room assignments) to `/see/finalize`, which creates everything in one
 * transaction. If anything fails, nothing is persisted.
 */
export function useSEERoomAssignment(args: {
  departmentId: string;
  semester: string;
  routine: SEERoutineEntry[];
  department: DepartmentData | null;
  avgStudentsPerClass?: number;
}) {
  const queryClient = useQueryClient();
  const avg = args.avgStudentsPerClass ?? 40;

  const initialSlots: SlotAllocation[] = useMemo(() => {
    if (!args.department) return [];
    return buildSEESlotAllocations(args.routine, args.department, avg);
  }, [args.routine, args.department, avg]);

  const [roomState, setRoomState] = useState<RoomAllocationState>({
    ...INITIAL_ROOM_STATE,
    slotAllocations: initialSlots,
  });

  // Sync slot allocations when the routine first lands (or the user goes
  // back to edit it). useEffect — never call setState during render.
  useEffect(() => {
    if (initialSlots.length === 0) return;
    setRoomState((prev) => {
      if (prev.slotAllocations.length === initialSlots.length) return prev;
      return { ...INITIAL_ROOM_STATE, slotAllocations: initialSlots };
    });
  }, [initialSlots]);

  const handleAddRoom = useCallback(
    (slotKey: string, deptId: string, room: RoomInfo) => {
      setRoomState((prev) => addRoom(prev, slotKey, deptId, room));
    },
    [],
  );

  const handleRemoveRoom = useCallback(
    (slotKey: string, deptId: string, roomId: string) => {
      setRoomState((prev) => removeRoom(prev, slotKey, deptId, roomId));
    },
    [],
  );

  const handleApplySharing = useCallback(
    (slotKey: string, targetDeptId: string, plan: SeatSharingPlanItem[]) => {
      setRoomState((prev) => applySharing(prev, slotKey, targetDeptId, plan));
    },
    [],
  );

  const handleRemoveSharing = useCallback(
    (slotKey: string, targetDeptId: string, roomId: string) => {
      setRoomState((prev) => removeSharing(prev, slotKey, targetDeptId, roomId));
    },
    [],
  );

  const handleSetShareableMark = useCallback(
    (slotKey: string, deptId: string, mark: ShareableRoomMark | null) => {
      setRoomState((prev) => setShareableMark(prev, slotKey, deptId, mark));
    },
    [],
  );

  const handleAddGlobalShared = useCallback(
    (slotKey: string, deptId: string, consumption: GlobalSharedConsumption) => {
      setRoomState((prev) => addGlobalShared(prev, slotKey, deptId, consumption));
    },
    [],
  );

  const handleRemoveGlobalShared = useCallback(
    (slotKey: string, deptId: string, examRoomId: string) => {
      setRoomState((prev) => removeGlobalShared(prev, slotKey, deptId, examRoomId));
    },
    [],
  );

  const roomWarnings = useMemo(
    () => getRoomWarnings(roomState.slotAllocations),
    [roomState.slotAllocations],
  );

  // The single-call transactional finalize. Nothing is in the database
  // before this fires; everything is either committed or rolled back.
  const finalizeMutation = useMutation({
    mutationFn: () =>
      finalizeSEEExam({
        departmentId: args.departmentId,
        semester: args.semester,
        schedules: args.routine.map((r) => ({
          slotKey: r.localId,
          courseId: r.courseId,
          date: r.date,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
        roomAssignments: buildAssignRoomsPayload(roomState.slotAllocations),
        shareableRoomMarks: buildShareableMarksPayload(roomState.slotAllocations),
        globalSharedConsumptions: buildGlobalConsumptionsPayload(
          roomState.slotAllocations,
        ),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared", "exam-groups"] });
      queryClient.invalidateQueries({ queryKey: ["exam-groups"] });
    },
  });

  return {
    slotAllocations: roomState.slotAllocations,
    usedRoomsMap: roomState.usedRoomsMap,
    roomWarnings,
    handleAddRoom,
    handleRemoveRoom,
    handleApplySharing,
    handleRemoveSharing,
    handleSetShareableMark,
    handleAddGlobalShared,
    handleRemoveGlobalShared,
    finalize: finalizeMutation.mutate,
    isFinalizing: finalizeMutation.isPending,
    finalizeError: finalizeMutation.error,
    finalizeSuccess: finalizeMutation.isSuccess,
  };
}
