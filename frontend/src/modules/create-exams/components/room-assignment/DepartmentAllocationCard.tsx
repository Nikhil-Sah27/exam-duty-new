import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import type {
  DepartmentAllocation,
  SlotAllocation,
  BuildingGrouped,
  RoomInfo,
  SeatSharingPlanItem,
  ReservationInfo,
  ShareableRoomOption,
  ShareableRoomMark,
  GlobalSharedConsumption,
} from "../../types";
import { getUnusedSeatsInSlot } from "../../services/seatSharing";
import { getDeptDisplayStats } from "../../selectors/allocationSelectors";
import RoomChip from "./RoomChip";
import RoomSelector from "./RoomSelector";
import SharedRoomIndicator from "../room-sharing/SharedRoomIndicator";
import SeatSuggestionBanner from "../room-sharing/SeatSuggestionBanner";
import SeatSharingModal from "../room-sharing/SeatSharingModal";
import MakeSharableBanner from "../room-sharing/MakeSharableBanner";
import MakeSharableModal from "../room-sharing/MakeSharableModal";
import UseSharedSeatsBanner from "../room-sharing/UseSharedSeatsBanner";
import UseSharedSeatsModal from "../room-sharing/UseSharedSeatsModal";
import GlobalSharedReceivedList from "../room-sharing/GlobalSharedReceivedList";

interface DepartmentAllocationCardProps {
  allocation: DepartmentAllocation;
  slot: SlotAllocation;
  buildings: BuildingGrouped[];
  avgStudentsPerClass: number;
  disabledRoomIds: Set<string>;
  reservedRoomInfo?: Map<string, ReservationInfo>;
  shareableOptions: ShareableRoomOption[];
  defaultExpanded?: boolean;
  onAddRoom: (room: RoomInfo) => void;
  onRemoveRoom: (roomId: string) => void;
  onApplySharing: (plan: SeatSharingPlanItem[]) => void;
  onRemoveSharing: (roomId: string) => void;
  onSetShareableMark: (mark: ShareableRoomMark | null) => void;
  onAddGlobalShared: (consumption: GlobalSharedConsumption) => void;
  onRemoveGlobalShared: (examRoomId: string) => void;
}

export default function DepartmentAllocationCard({
  allocation,
  slot,
  buildings,
  avgStudentsPerClass,
  disabledRoomIds,
  reservedRoomInfo,
  shareableOptions,
  defaultExpanded = false,
  onAddRoom,
  onRemoveRoom,
  onApplySharing,
  onRemoveSharing,
  onSetShareableMark,
  onAddGlobalShared,
  onRemoveGlobalShared,
}: DepartmentAllocationCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [makeSharableOpen, setMakeSharableOpen] = useState(false);
  const [useSharedOpen, setUseSharedOpen] = useState(false);

  const { students, assignedRooms, departmentCode, courseName, courseId } = allocation;

  // Unused seats from other departments in same slot. Computed before the
  // early return below — hooks must run on every render path.
  const unusedSeats = useMemo(
    () => getUnusedSeatsInSlot(slot, allocation.departmentId),
    [slot, allocation.departmentId]
  );

  // No exam scheduled
  if (!courseId) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-3">
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-gray-500">{departmentCode}</span>
          {" "}&mdash; No exam scheduled
        </p>
      </div>
    );
  }

  // All business-logic derived from utils — component only handles presentation
  const stats = getDeptDisplayStats(allocation, avgStudentsPerClass);
  const {
    ownCapacity, effectiveCapacity, effectiveRemaining,
    sharedReceived, globalSharedReceived: globalSharedReceivedCount,
    extra, shareableExtra, capacityMet, needed,
    progressPct, ownPct,
  } = stats;
  // The progress bar and header badges should treat intra-batch and cross-
  // group shared seats identically — both are borrowed capacity from another
  // dept and should render as the orange segment.
  const totalSharedReceived = sharedReceived + globalSharedReceivedCount;
  const assignedRoomIds = assignedRooms.map((r) => r._id);

  // Presentation mappings (data → CSS classes)
  const progressColor = capacityMet ? "bg-green-500" : progressPct > 50 ? "bg-amber-500" : "bg-red-500";

  const borderColor = capacityMet
    ? "border-green-200"
    : assignedRooms.length > 0 || totalSharedReceived > 0
      ? "border-amber-200"
      : "border-gray-200";

  return (
    <>
      <div className={`rounded-lg border-2 bg-white transition-colors ${borderColor}`}>
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold text-gray-700">
                  {departmentCode}
                </span>
                <span className="truncate text-sm text-gray-500">{courseName}</span>
                {totalSharedReceived > 0 && (
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">
                    +{totalSharedReceived} shared
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {students} students
                </span>
                <span>{assignedRooms.length} room{assignedRooms.length !== 1 ? "s" : ""}</span>
                <span>cap: {effectiveCapacity}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Capacity progress mini-bar */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100">
                {/* Own capacity segment */}
                <div className="flex h-full">
                  <div
                    className={`h-full transition-all duration-300 ${progressColor}`}
                    style={{ width: `${ownPct}%` }}
                  />
                  {/* Shared seats segment (intra-batch + cross-group) */}
                  {totalSharedReceived > 0 && (
                    <div
                      className="h-full bg-orange-400 transition-all duration-300"
                      style={{ width: `${progressPct - ownPct}%` }}
                    />
                  )}
                </div>
              </div>
              <span className="text-[10px] font-semibold text-gray-400">{progressPct}%</span>
            </div>

            {/* Status badge */}
            {capacityMet ? (
              <span className="flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                {extra > 0 ? `+${extra} extra` : "Covered"}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                <AlertTriangle className="h-3 w-3" />
                {effectiveRemaining} left
              </span>
            )}
          </div>
        </button>

        {/* Expanded body */}
        {isExpanded && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-4">
            {/* === Selected Rooms Bar === */}
            {assignedRooms.length > 0 && (
              <div className="rounded-lg bg-indigo-50/50 px-3 py-2.5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-indigo-400">
                  Selected Rooms
                </p>
                <div className="flex flex-wrap gap-2">
                  {assignedRooms.map((room) => (
                    <RoomChip key={room._id} room={room} onRemove={onRemoveRoom} />
                  ))}
                </div>
              </div>
            )}

            {/* === Shared Seats Received === */}
            {allocation.sharedSeatsReceived.length > 0 && (
              <div className="rounded-lg bg-orange-50/50 px-3 py-2.5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-orange-400">
                  Shared Seats (Received)
                </p>
                <div className="space-y-1.5">
                  {allocation.sharedSeatsReceived.map((share) => (
                    <SharedRoomIndicator
                      key={`${share.roomId}-${share.ownerDeptId}`}
                      share={share}
                      perspective="receiver"
                      onRemove={() => onRemoveSharing(share.roomId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* === Shared Seats Given Away === */}
            {allocation.sharedSeatsGiven.length > 0 && (
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Seats Shared Out
                </p>
                <div className="space-y-1.5">
                  {allocation.sharedSeatsGiven.map((share) => (
                    <SharedRoomIndicator
                      key={`${share.roomId}-${share.targetDeptId}`}
                      share={share}
                      perspective="giver"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* === Real-time warnings === */}
            <div className="space-y-1.5">
              {!capacityMet && effectiveRemaining > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  <p className="text-xs font-medium text-red-600">
                    {effectiveRemaining} students remaining — need ~{needed} more class{needed !== 1 ? "es" : ""}
                  </p>
                </div>
              )}
              {capacityMet && extra === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  <p className="text-xs font-medium text-green-600">
                    All students accommodated
                  </p>
                </div>
              )}
              {(shareableExtra > 0 || allocation.shareableMark) && (
                <MakeSharableBanner
                  extraSeats={shareableExtra}
                  assignedRooms={assignedRooms}
                  mark={allocation.shareableMark}
                  onOpenModal={() => setMakeSharableOpen(true)}
                  onUnmark={() => onSetShareableMark(null)}
                />
              )}
            </div>

            {/* === Global Shared Seats Received === */}
            {allocation.globalSharedReceived.length > 0 && (
              <GlobalSharedReceivedList
                consumptions={allocation.globalSharedReceived}
                onRemove={onRemoveGlobalShared}
              />
            )}

            {/* === Intra-batch Seat Sharing Suggestion === */}
            {!capacityMet && effectiveRemaining > 0 && unusedSeats.length > 0 && (
              <SeatSuggestionBanner
                unusedSeats={unusedSeats}
                remainingStudents={effectiveRemaining}
                onOpenModal={() => setSharingModalOpen(true)}
              />
            )}

            {/* === Global Seat Sharing (cross-exam-group) Suggestion === */}
            {!capacityMet && effectiveRemaining > 0 && shareableOptions.length > 0 && (
              <UseSharedSeatsBanner
                options={shareableOptions}
                remainingStudents={effectiveRemaining}
                onOpenModal={() => setUseSharedOpen(true)}
              />
            )}

            {/* === Capacity bar === */}
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-gray-400">
                <span>
                  {effectiveCapacity} / {students} seats filled
                  {totalSharedReceived > 0 && (
                    <span className="text-orange-500"> (incl. {totalSharedReceived} shared)</span>
                  )}
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="flex h-full">
                  <div
                    className={`h-full transition-all duration-500 ease-out ${progressColor}`}
                    style={{ width: `${ownPct}%` }}
                  />
                  {totalSharedReceived > 0 && (
                    <div
                      className="h-full bg-orange-400 transition-all duration-500 ease-out"
                      style={{ width: `${progressPct - ownPct}%` }}
                    />
                  )}
                </div>
              </div>
              {totalSharedReceived > 0 && (
                <div className="mt-1 flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${progressColor}`} />
                    Own rooms
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
                    Shared seats
                  </span>
                </div>
              )}
            </div>

            {/* === Room grid === */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                {capacityMet ? "Capacity met — remove a room to reassign" : "Select rooms"}
              </p>
              <RoomSelector
                buildings={buildings}
                assignedRoomIds={assignedRoomIds}
                disabledRoomIds={disabledRoomIds}
                reservedRoomInfo={reservedRoomInfo}
                capacityMet={capacityMet}
                onToggle={(room) => {
                  if (assignedRoomIds.includes(room._id)) {
                    onRemoveRoom(room._id);
                  } else {
                    onAddRoom(room);
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Intra-batch Seat Sharing Modal */}
      <SeatSharingModal
        open={sharingModalOpen}
        onClose={() => setSharingModalOpen(false)}
        targetDeptCode={departmentCode}
        remainingStudents={Math.max(0, effectiveRemaining)}
        unusedSeats={unusedSeats}
        onConfirm={onApplySharing}
      />

      {/* Global Seat Sharing — owner side */}
      <MakeSharableModal
        open={makeSharableOpen}
        onClose={() => setMakeSharableOpen(false)}
        departmentCode={departmentCode}
        assignedRooms={assignedRooms}
        extraSeats={shareableExtra}
        currentMark={allocation.shareableMark}
        onConfirm={onSetShareableMark}
      />

      {/* Global Seat Sharing — consumer side */}
      <UseSharedSeatsModal
        open={useSharedOpen}
        onClose={() => setUseSharedOpen(false)}
        options={shareableOptions}
        existingConsumptions={allocation.globalSharedReceived}
        remainingStudents={Math.max(0, effectiveRemaining)}
        onConfirm={onAddGlobalShared}
      />
    </>
  );
}
