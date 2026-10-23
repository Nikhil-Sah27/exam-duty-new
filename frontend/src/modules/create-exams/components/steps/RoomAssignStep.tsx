import { useMemo } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LayoutGrid,
  Users,
  DoorOpen,
  Share2,
} from "lucide-react";
import Button from "@/shared/components/Button";
import { useCIERooms } from "../../hooks";
import { useSlotReservations } from "../../hooks/useSlotReservations";
import { useSlotShareableRooms } from "../../hooks/useSlotShareableRooms";
import type {
  SlotAllocation,
  UsedRoomsMap,
  RoomInfo,
  SeatSharingPlanItem,
  ReservationInfo,
  Shift,
  ShareableRoomOption,
  ShareableRoomMark,
  GlobalSharedConsumption,
} from "../../types";
import { getSlotKey } from "../../services/roomAllocation";
import { reservationSlotKey } from "../../utils/roomReservationUtils";
import { getGlobalAllocationStats } from "../../selectors/allocationSelectors";
import { getDisabledRoomsBySlot } from "../../selectors/roomAssignSelectors";
import SlotCard from "../room-assignment/SlotCard";

interface RoomAssignStepProps {
  slotAllocations: SlotAllocation[];
  shifts: Shift[];
  usedRoomsMap: UsedRoomsMap;
  avgStudentsPerClass: number;
  warnings: string[];
  isAssigning: boolean;
  /** Server-side error from the finalize call, surfaced inline above actions. */
  error?: string | null;
  /** Passed to the seat-sharing hook when editing an existing group. */
  excludeExamGroupId?: string | null;
  /**
   * Extra rooms to disable per local slotKey, unioned with the usual
   * used/reserved sets. Used by the multi-department SEE flow to block a room
   * already assigned to another exam in the same unsaved batch whose window
   * overlaps this slot. Keyed by `getSlotKey(date, shiftIndex)`.
   */
  extraDisabledBySlot?: Map<string, Set<string>>;
  /**
   * When true, slots are rendered with a department header before each run of
   * slots belonging to a new department (SEE lists one department's exams fully
   * before the next). Assumes each slot has a single department.
   */
  groupByDepartment?: boolean;
  onAddRoom: (slotKey: string, deptId: string, room: RoomInfo) => void;
  onRemoveRoom: (slotKey: string, deptId: string, roomId: string) => void;
  onApplySharing: (slotKey: string, deptId: string, plan: SeatSharingPlanItem[]) => void;
  onRemoveSharing: (slotKey: string, deptId: string, roomId: string) => void;
  onSetShareableMark: (slotKey: string, deptId: string, mark: ShareableRoomMark | null) => void;
  onAddGlobalShared: (slotKey: string, deptId: string, consumption: GlobalSharedConsumption) => void;
  onRemoveGlobalShared: (slotKey: string, deptId: string, examRoomId: string) => void;
  onAssignRooms: () => void;
  onPrev: () => void;
}

export default function RoomAssignStep({
  slotAllocations,
  shifts,
  usedRoomsMap,
  avgStudentsPerClass,
  warnings,
  isAssigning,
  error,
  excludeExamGroupId,
  extraDisabledBySlot,
  groupByDepartment,
  onAddRoom,
  onRemoveRoom,
  onApplySharing,
  onRemoveSharing,
  onSetShareableMark,
  onAddGlobalShared,
  onRemoveGlobalShared,
  onAssignRooms,
  onPrev,
}: RoomAssignStepProps) {
  const { data: buildings = [], isLoading } = useCIERooms();

  // Slot windows expressed in absolute (date, startTime, endTime) so the
  // global-reservation lookup can join against ExamSchedule on the server.
  const slotWindows = useMemo(
    () =>
      slotAllocations
        .map((slot) => {
          const shift = shifts[slot.shiftIndex];
          if (!shift) return null;
          return {
            date: slot.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
          };
        })
        .filter((w): w is { date: string; startTime: string; endTime: string } => w !== null),
    [slotAllocations, shifts],
  );

  const { reservedBySlot } = useSlotReservations(slotWindows, excludeExamGroupId);
  const { shareableBySlot } = useSlotShareableRooms(
    slotWindows,
    excludeExamGroupId,
  );

  // Union local (usedRoomsMap) with global reservations + globally-shareable
  // rooms — a room owned by another exam group can be BORROWED via the
  // seat-sharing modal but must never be selectable directly from the picker,
  // so we disable it in the grid the same way as any reservation.
  const disabledBySlot = useMemo(() => {
    const map = getDisabledRoomsBySlot(slotAllocations, usedRoomsMap);
    for (const slot of slotAllocations) {
      const shift = shifts[slot.shiftIndex];
      if (!shift) continue;
      const localKey = getSlotKey(slot.date, slot.shiftIndex);
      const globalKey = reservationSlotKey(
        slot.date,
        shift.startTime,
        shift.endTime,
      );
      const reserved = reservedBySlot.get(globalKey);
      const shareable = shareableBySlot.get(globalKey);
      if ((!reserved || reserved.size === 0) && (!shareable || shareable.length === 0)) {
        continue;
      }
      const merged = new Set(map.get(localKey) || []);
      if (reserved) for (const roomId of reserved.keys()) merged.add(roomId);
      if (shareable) for (const opt of shareable) merged.add(opt.roomId);
      map.set(localKey, merged);
    }
    // Union in caller-supplied extra disabled rooms (e.g. SEE cross-slot
    // overlaps across departments in the same unsaved batch).
    if (extraDisabledBySlot) {
      for (const [localKey, extra] of extraDisabledBySlot) {
        if (extra.size === 0) continue;
        const merged = new Set(map.get(localKey) || []);
        for (const roomId of extra) merged.add(roomId);
        map.set(localKey, merged);
      }
    }
    return map;
  }, [slotAllocations, usedRoomsMap, shifts, reservedBySlot, shareableBySlot, extraDisabledBySlot]);

  // ReservationInfo lookup keyed by the *local* slotKey so SlotCard doesn't
  // need to know about the server's slotKey format.
  const reservedInfoBySlot = useMemo(() => {
    const map = new Map<string, Map<string, ReservationInfo>>();
    for (const slot of slotAllocations) {
      const shift = shifts[slot.shiftIndex];
      if (!shift) continue;
      const localKey = getSlotKey(slot.date, slot.shiftIndex);
      const globalKey = reservationSlotKey(
        slot.date,
        shift.startTime,
        shift.endTime,
      );
      const reserved = reservedBySlot.get(globalKey);
      if (reserved && reserved.size > 0) map.set(localKey, reserved);
    }
    return map;
  }, [slotAllocations, shifts, reservedBySlot]);

  // Shareable-rooms lookup keyed by the *local* slotKey. The `remainingSeats`
  // returned by the backend is the persistent pool at fetch time; subtract any
  // in-session consumptions this batch has already committed to so the banner
  // and picker never advertise seats another dept in the same batch already
  // claimed. Removing a consumption on the client restores the count for free.
  const shareableOptionsBySlot = useMemo(() => {
    const map = new Map<string, ShareableRoomOption[]>();
    for (const slot of slotAllocations) {
      const shift = shifts[slot.shiftIndex];
      if (!shift) continue;
      const localKey = getSlotKey(slot.date, slot.shiftIndex);
      const globalKey = reservationSlotKey(
        slot.date,
        shift.startTime,
        shift.endTime,
      );
      const opts = shareableBySlot.get(globalKey);
      if (!opts || opts.length === 0) continue;

      const usedByExamRoom = new Map<string, number>();
      for (const dept of slot.departments) {
        for (const c of dept.globalSharedReceived) {
          usedByExamRoom.set(
            c.examRoomId,
            (usedByExamRoom.get(c.examRoomId) || 0) + c.studentsAllocated,
          );
        }
      }

      const adjusted = opts.map((o) => {
        const used = usedByExamRoom.get(o.examRoomId) || 0;
        return {
          ...o,
          remainingSeats: Math.max(0, o.remainingSeats - used),
        };
      });
      map.set(localKey, adjusted);
    }
    return map;
  }, [slotAllocations, shifts, shareableBySlot]);

  // All business-logic derived from utils — component only handles presentation
  const globalStats = useMemo(
    () => getGlobalAllocationStats(slotAllocations),
    [slotAllocations]
  );

  // Block the Finish & Create button until every active department in every
  // slot has at least one assigned room (either primary or shared seats).
  // Matches the backend's validation in cie.service.finalizeCIEPlan.
  const allSlotsReady = useMemo(() => {
    if (slotAllocations.length === 0) return false;
    return slotAllocations.every((slot) => {
      const active = slot.departments.filter((d) => d.courseId);
      if (active.length === 0) return true;
      return active.every(
        (d) =>
          d.assignedRooms.length > 0 ||
          d.sharedSeatsReceived.length > 0 ||
          d.globalSharedReceived.length > 0,
      );
    });
  }, [slotAllocations]);

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-gray-400">Loading rooms...</p>;
  }

  const globalPct = globalStats.progressPct;

  return (
    <div className="space-y-6">
      {/* === Global Stats Bar === */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            {/* Rooms assigned */}
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-indigo-50 p-2">
                <DoorOpen className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">{globalStats.totalRoomsAssigned}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Rooms</p>
              </div>
            </div>

            {/* Students covered */}
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">
                  {globalStats.totalCapacity}
                  <span className="text-sm font-normal text-gray-400">/{globalStats.totalStudents}</span>
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Capacity</p>
              </div>
            </div>

            {/* Shared seats */}
            {globalStats.totalSharedSeats > 0 && (
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-orange-50 p-2">
                  <Share2 className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-800">{globalStats.totalSharedSeats}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Shared</p>
                </div>
              </div>
            )}

            {/* Slots covered */}
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-green-50 p-2">
                <LayoutGrid className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">
                  {globalStats.slotsCovered}
                  <span className="text-sm font-normal text-gray-400">/{globalStats.slotsTotal}</span>
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Slots Done</p>
              </div>
            </div>
          </div>

          {/* Overall progress */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-600">
                {globalStats.deptsCovered}/{globalStats.deptsTotal} depts covered
              </p>
            </div>
            <div className="h-10 w-10 relative">
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke={globalStats.allCovered ? "#22c55e" : "#f59e0b"}
                  strokeWidth="3"
                  strokeDasharray={`${globalPct} ${100 - globalPct}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-600">
                {globalPct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* === Warnings === */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            {warnings.join(" | ")}
          </p>
        </div>
      )}

      {/* === Slot List === */}
      {slotAllocations.map((slot, index) => {
        const slotKey = getSlotKey(slot.date, slot.shiftIndex);
        // Department header: shown before the first slot of each department
        // when grouping is on (SEE lists one department's exams fully first).
        const deptCode = slot.departments[0]?.departmentCode;
        const prevDeptCode =
          index > 0 ? slotAllocations[index - 1].departments[0]?.departmentCode : null;
        const showDeptHeader =
          groupByDepartment && deptCode && deptCode !== prevDeptCode;
        return (
          <div key={slotKey} className="space-y-3">
            {showDeptHeader && (
              <div className="flex items-center gap-2 pt-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-pink-500 to-purple-600 px-3 py-1.5 text-sm font-bold text-white shadow-sm">
                  {deptCode}
                </span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
            )}
            <SlotCard
            slot={slot}
            buildings={buildings}
            avgStudentsPerClass={avgStudentsPerClass}
            disabledRoomIds={disabledBySlot.get(slotKey) || new Set()}
            reservedRoomInfo={reservedInfoBySlot.get(slotKey)}
            shareableOptions={shareableOptionsBySlot.get(slotKey) || []}
            flattenSingleDepartment={groupByDepartment}
            defaultExpanded={index === 0}
            onAddRoom={(deptId, room) => onAddRoom(slotKey, deptId, room)}
            onRemoveRoom={(deptId, roomId) => onRemoveRoom(slotKey, deptId, roomId)}
            onApplySharing={(deptId, plan) => onApplySharing(slotKey, deptId, plan)}
            onRemoveSharing={(deptId, roomId) => onRemoveSharing(slotKey, deptId, roomId)}
            onSetShareableMark={(deptId, mark) => onSetShareableMark(slotKey, deptId, mark)}
            onAddGlobalShared={(deptId, consumption) =>
              onAddGlobalShared(slotKey, deptId, consumption)
            }
            onRemoveGlobalShared={(deptId, examRoomId) =>
              onRemoveGlobalShared(slotKey, deptId, examRoomId)
            }
            />
          </div>
        );
      })}

      {/* === Block-on-incomplete notice === */}
      {!allSlotsReady && slotAllocations.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-700">
          Cannot create exam until all schedules have rooms assigned.
        </div>
      )}

      {/* === Server-side error === */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* === Actions === */}
      <div className="sticky bottom-0 flex justify-between border-t border-gray-100 bg-gray-50/80 px-1 py-4 backdrop-blur">
        <Button variant="secondary" onClick={onPrev}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Routine
        </Button>
        <Button
          onClick={onAssignRooms}
          disabled={isAssigning || !allSlotsReady}
          title={!allSlotsReady ? "All schedules must have at least one room" : undefined}
        >
          {isAssigning ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Creating Exam...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Finish &amp; Create Exam
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
