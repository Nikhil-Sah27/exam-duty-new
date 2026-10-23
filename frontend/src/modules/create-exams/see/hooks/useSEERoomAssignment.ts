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
import { getSlotKey } from "../../services/roomAllocation";
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
  Shift,
} from "../../types";
import type { SEERoutineEntry, SEEDepartmentPlan } from "../types";
import { buildSEESlotAllocations } from "../utils/seeTransformUtils";

const toMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const overlaps = (aS: string, aE: string, bS: string, bE: string): boolean =>
  toMinutes(aS) < toMinutes(bE) && toMinutes(bS) < toMinutes(aE);
const sameDay = (a: string, b: string): boolean => {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return da.getTime() === db.getTime();
};

/**
 * Drives the multi-department SEE room-assignment phase. Reuses the CIE
 * roomAllocationReducer for the slot state machine. Slots are laid out
 * department-by-department (all of CSE's exams, then all of ME's). Nothing is
 * persisted until "Finish & Create Exam", which ships one plan per department
 * to `/see/finalize` — each becomes its own separate exam card.
 */
export function useSEERoomAssignment(args: {
  departmentIds: string[];
  semester: string;
  routineByDept: Map<string, SEERoutineEntry[]>;
  departmentById: Map<string, DepartmentData>;
  avgStudentsPerClass?: number;
}) {
  const queryClient = useQueryClient();
  const avg = args.avgStudentsPerClass ?? 40;

  // Flatten the routine department-by-department so one department's exams are
  // listed fully before the next.
  const orderedRoutine: SEERoutineEntry[] = useMemo(() => {
    const out: SEERoutineEntry[] = [];
    for (const deptId of args.departmentIds) {
      out.push(...(args.routineByDept.get(deptId) ?? []));
    }
    return out;
  }, [args.departmentIds, args.routineByDept]);

  // One fabricated "shift" per slot, indexed by slot ordinality, so the shared
  // RoomAssignStep (which reads shifts[shiftIndex]) resolves each slot's window.
  const shifts: Shift[] = useMemo(
    () =>
      orderedRoutine.map((entry) => ({
        name: `${entry.startTime} – ${entry.endTime}`,
        startTime: entry.startTime,
        endTime: entry.endTime,
      })),
    [orderedRoutine],
  );

  const initialSlots: SlotAllocation[] = useMemo(
    () => buildSEESlotAllocations(orderedRoutine, args.departmentById, avg),
    [orderedRoutine, args.departmentById, avg],
  );

  const [roomState, setRoomState] = useState<RoomAllocationState>({
    ...INITIAL_ROOM_STATE,
    slotAllocations: initialSlots,
  });

  // Re-seed the reducer whenever the routine shape changes (e.g. the user went
  // back to edit it). Keyed off the slot scheduleIds so a pure room edit within
  // the phase never clobbers in-progress assignments.
  const slotSignature = useMemo(
    () => initialSlots.map((s) => s.scheduleId).join("|"),
    [initialSlots],
  );
  useEffect(() => {
    setRoomState({ ...INITIAL_ROOM_STATE, slotAllocations: initialSlots });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotSignature]);

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

  // Cross-slot room conflicts within this unsaved batch: a physical room
  // assigned to one exam must be blocked for every OTHER exam whose time window
  // overlaps it — including exams in a different department. The reducer's
  // usedRoomsMap only guards within a single slotKey, so we compute the
  // cross-slot overlaps here and feed them to RoomAssignStep as extra disabled
  // rooms. (The backend enforces the same rule via assertNoConflicts.)
  const windowByScheduleId = useMemo(() => {
    const map = new Map<string, { date: string; startTime: string; endTime: string }>();
    for (const e of orderedRoutine) {
      map.set(e.localId, { date: e.date, startTime: e.startTime, endTime: e.endTime });
    }
    return map;
  }, [orderedRoutine]);

  const extraDisabledBySlot = useMemo(() => {
    const slots = roomState.slotAllocations;
    const roomsBySlot = slots.map((s) => {
      const ids = new Set<string>();
      for (const d of s.departments) for (const r of d.assignedRooms) ids.add(r._id);
      return ids;
    });
    const map = new Map<string, Set<string>>();
    for (let i = 0; i < slots.length; i++) {
      const wi = windowByScheduleId.get(slots[i].scheduleId);
      const disabled = new Set<string>();
      if (wi) {
        for (let j = 0; j < slots.length; j++) {
          if (i === j) continue;
          const wj = windowByScheduleId.get(slots[j].scheduleId);
          if (!wj) continue;
          if (!sameDay(wi.date, wj.date)) continue;
          if (!overlaps(wi.startTime, wi.endTime, wj.startTime, wj.endTime)) continue;
          for (const id of roomsBySlot[j]) disabled.add(id);
        }
      }
      map.set(getSlotKey(slots[i].date, slots[i].shiftIndex), disabled);
    }
    return map;
  }, [roomState.slotAllocations, windowByScheduleId]);

  // Build one SEEDepartmentPlan per department from the slot allocations + the
  // department's routine. Nothing is persisted before this ships.
  const buildPayloadDepartments = useCallback((): SEEDepartmentPlan[] => {
    return args.departmentIds.map((deptId) => {
      const deptSlots = roomState.slotAllocations.filter(
        (s) => s.departments[0]?.departmentId === deptId,
      );
      const deptRoutine = args.routineByDept.get(deptId) ?? [];
      return {
        departmentId: deptId,
        schedules: deptRoutine.map((r) => ({
          slotKey: r.localId,
          courseId: r.courseId,
          date: r.date,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
        roomAssignments: buildAssignRoomsPayload(deptSlots),
        shareableRoomMarks: buildShareableMarksPayload(deptSlots),
        globalSharedConsumptions: buildGlobalConsumptionsPayload(deptSlots),
      };
    });
  }, [args.departmentIds, args.routineByDept, roomState.slotAllocations]);

  const finalizeMutation = useMutation({
    mutationFn: () =>
      finalizeSEEExam({
        semester: args.semester,
        departments: buildPayloadDepartments(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared", "exam-groups"] });
      queryClient.invalidateQueries({ queryKey: ["exam-groups"] });
    },
  });

  return {
    slotAllocations: roomState.slotAllocations,
    usedRoomsMap: roomState.usedRoomsMap,
    shifts,
    extraDisabledBySlot,
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
