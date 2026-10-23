import { useState } from "react";
import { ChevronDown, ChevronRight, Calendar, Clock } from "lucide-react";
import type {
  SlotAllocation,
  BuildingGrouped,
  RoomInfo,
  SeatSharingPlanItem,
  ReservationInfo,
  ShareableRoomOption,
  ShareableRoomMark,
  GlobalSharedConsumption,
} from "../../types";
import { formatDate } from "../../utils/dateUtils";
import { getSlotEffectiveSummary } from "../../selectors/allocationSelectors";
import DepartmentAllocationCard from "./DepartmentAllocationCard";

interface SlotCardProps {
  slot: SlotAllocation;
  buildings: BuildingGrouped[];
  avgStudentsPerClass: number;
  disabledRoomIds: Set<string>;
  /** roomId → reservation info for rooms already booked by another exam. */
  reservedRoomInfo?: Map<string, ReservationInfo>;
  /** Globally-shareable rooms whose owner schedule overlaps this slot. */
  shareableOptions: ShareableRoomOption[];
  defaultExpanded?: boolean;
  /**
   * When the slot has a single department (SEE), render it flat — the course is
   * named in this slot's header and the per-department sub-card is dropped, so
   * the room picker isn't nested under a redundant second category.
   */
  flattenSingleDepartment?: boolean;
  onAddRoom: (deptId: string, room: RoomInfo) => void;
  onRemoveRoom: (deptId: string, roomId: string) => void;
  onApplySharing: (deptId: string, plan: SeatSharingPlanItem[]) => void;
  onRemoveSharing: (deptId: string, roomId: string) => void;
  onSetShareableMark: (deptId: string, mark: ShareableRoomMark | null) => void;
  onAddGlobalShared: (deptId: string, consumption: GlobalSharedConsumption) => void;
  onRemoveGlobalShared: (deptId: string, examRoomId: string) => void;
}

export default function SlotCard({
  slot,
  buildings,
  avgStudentsPerClass,
  disabledRoomIds,
  reservedRoomInfo,
  shareableOptions,
  defaultExpanded = false,
  flattenSingleDepartment = false,
  onAddRoom,
  onRemoveRoom,
  onApplySharing,
  onRemoveSharing,
  onSetShareableMark,
  onAddGlobalShared,
  onRemoveGlobalShared,
}: SlotCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // All business-logic derived from utils — component only handles presentation
  const slotSummary = getSlotEffectiveSummary(slot);
  const {
    activeDepts, totalStudents, totalSharedSeats,
    effectiveTotalCapacity, effectiveAllCovered,
    effectiveRemaining, effectiveDeptsCovered,
    departmentsTotal, firstUncoveredIdx, progressPct,
  } = slotSummary;

  // Single-department (SEE) layout: this slot's one department is rendered flat
  // and its course is surfaced in the header below.
  const singleDept =
    flattenSingleDepartment && activeDepts.length === 1 ? activeDepts[0] : null;

  // No departments have exams
  if (activeDepts.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50/30 shadow-sm">
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-gray-400">
            {formatDate(slot.date)} — {slot.shiftName}
          </p>
          <p className="mt-0.5 text-xs text-gray-300">No exam scheduled</p>
        </div>
      </section>
    );
  }

  // Presentation mappings (data → CSS classes)
  const progressColor = effectiveAllCovered ? "bg-green-500" : progressPct > 50 ? "bg-amber-500" : "bg-red-400";

  const borderColor = effectiveAllCovered
    ? "border-green-200"
    : effectiveTotalCapacity > 0
      ? "border-amber-200"
      : "border-gray-200";

  return (
    <section className={`rounded-xl border-2 bg-white shadow-sm transition-colors ${borderColor}`}>
      {/* Slot Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {formatDate(slot.date)}
              <span className="text-gray-300">|</span>
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {slot.shiftName}
              {totalSharedSeats > 0 && (
                <span className="rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">
                  {totalSharedSeats} shared
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {singleDept ? (
                <span className="font-medium text-gray-500">{singleDept.courseName} &middot;{" "}</span>
              ) : (
                <>
                  {activeDepts.length} dept{activeDepts.length !== 1 ? "s" : ""} &middot;{" "}
                </>
              )}
              {totalStudents} students &middot;{" "}
              capacity {effectiveTotalCapacity}
              {totalSharedSeats > 0 && (
                <span className="text-orange-500"> (incl. {totalSharedSeats} shared)</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-gray-400">{progressPct}%</span>
          </div>

          {/* Status */}
          {effectiveAllCovered ? (
            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
              All covered
            </span>
          ) : (
            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
              {effectiveRemaining} remaining
            </span>
          )}

          {/* Dept coverage — redundant when the slot has a single department. */}
          {!singleDept && (
            <span className="text-xs text-gray-400">
              <span className={effectiveAllCovered ? "font-semibold text-green-600" : "font-semibold text-gray-600"}>
                {effectiveDeptsCovered}
              </span>
              /{departmentsTotal} depts
            </span>
          )}
        </div>
      </button>

      {/* Department Allocations */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {slot.departments.map((dept) => (
            <DepartmentAllocationCard
              key={dept.departmentId}
              allocation={dept}
              slot={slot}
              buildings={buildings}
              avgStudentsPerClass={avgStudentsPerClass}
              disabledRoomIds={disabledRoomIds}
              reservedRoomInfo={reservedRoomInfo}
              shareableOptions={shareableOptions}
              flat={Boolean(singleDept)}
              defaultExpanded={activeDepts[firstUncoveredIdx]?.departmentId === dept.departmentId}
              onAddRoom={(room) => onAddRoom(dept.departmentId, room)}
              onRemoveRoom={(roomId) => onRemoveRoom(dept.departmentId, roomId)}
              onApplySharing={(plan) => onApplySharing(dept.departmentId, plan)}
              onRemoveSharing={(roomId) => onRemoveSharing(dept.departmentId, roomId)}
              onSetShareableMark={(mark) => onSetShareableMark(dept.departmentId, mark)}
              onAddGlobalShared={(consumption) =>
                onAddGlobalShared(dept.departmentId, consumption)
              }
              onRemoveGlobalShared={(examRoomId) =>
                onRemoveGlobalShared(dept.departmentId, examRoomId)
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
