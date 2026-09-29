import {
  ArrowLeftRight,
  Ban,
  Calendar,
  Clock,
  Crown,
  DoorOpen,
  Users,
} from "lucide-react";
import type { DcsDutyGroup } from "@/modules/duties/services/dcsGroupingService";

const DEPT_COLORS: Record<string, string> = {
  CSE: "bg-blue-100 text-blue-700",
  ECE: "bg-purple-100 text-purple-700",
  ISE: "bg-emerald-100 text-emerald-700",
  ME: "bg-orange-100 text-orange-700",
  MECH: "bg-orange-100 text-orange-700",
  CE: "bg-amber-100 text-amber-700",
  EEE: "bg-rose-100 text-rose-700",
  AIML: "bg-indigo-100 text-indigo-700",
};

const getDeptColor = (d: string): string =>
  DEPT_COLORS[d.toUpperCase()] || "bg-gray-100 text-gray-600";

const formatDate = (s: string): string =>
  new Date(s).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatTime = (t: string): string => {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
};

export interface DcsGroupRequestCardProps {
  group: DcsDutyGroup;
  /** Render style: "owned" = my duty (action button), "target" = selectable target. */
  variant?: "owned" | "target";
  /** When set, surfaces a "Request Change" action. Hidden in target variant. */
  onRequestChange?: (group: DcsDutyGroup) => void;
  /** Click handler for target variant. */
  onSelect?: (group: DcsDutyGroup) => void;
  /** Optional pending state — disables the action and reads "Request Pending". */
  pending?: boolean;
  /** Visual emphasis when the target is currently selected. */
  selected?: boolean;
}

/**
 * The DCS-side equivalent of the per-room duty card. A "DCS Duty Group" is
 * the unit a DCS supervises (a bundle of rooms sharing one schedule), and
 * any change request is filed against the whole group — never an individual
 * classroom. Used on the DCS Change Requests page and on the swap-target
 * modal that lists candidate groups to move to.
 */
export default function DcsGroupRequestCard({
  group,
  variant = "owned",
  onRequestChange,
  onSelect,
  pending = false,
  selected = false,
}: DcsGroupRequestCardProps) {
  const ringClasses = selected
    ? "border-blue-500 ring-2 ring-blue-200"
    : "border-blue-200 hover:border-blue-400";
  const isTarget = variant === "target";

  return (
    <article
      className={`group/card relative flex flex-col gap-3 overflow-hidden rounded-2xl border-2 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 shadow-sm transition-all hover:shadow-md ${ringClasses}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {group.examGroup && (
            <>
              <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                {group.examGroup.examType}
              </span>
              <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 ring-1 ring-gray-200">
                Sem {group.examGroup.semester}
              </span>
            </>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <Crown className="h-2.5 w-2.5" />
            DCS Duty Group #{group.groupIndex}
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-gray-400" />
          {formatDate(group.schedule.date)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-gray-400" />
          {formatTime(group.schedule.startTime)} – {formatTime(group.schedule.endTime)}
        </span>
      </div>

      <div className="rounded-lg bg-white/70 px-3 py-2 ring-1 ring-white/40">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Assigned Rooms
          </p>
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <DoorOpen className="h-3 w-3 text-gray-400" />
              {group.assignedRooms.length}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-gray-400" />
              {group.assignedStudents}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {group.assignedRooms.map((er) => (
            <span
              key={er._id}
              className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200"
              title={
                er.room.building
                  ? `${er.room.building.name} · Floor ${er.room.floor}`
                  : undefined
              }
            >
              <DoorOpen className="h-2.5 w-2.5 text-gray-400" />
              {er.room.roomNumber}
            </span>
          ))}
        </div>
      </div>

      {group.assignedDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-blue-100 pt-2">
          {group.assignedDepartments.map((d) => (
            <span
              key={d}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getDeptColor(d)}`}
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {isTarget && onSelect && (
        <button
          onClick={() => onSelect(group)}
          className={`mt-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            selected
              ? "bg-blue-600 text-white"
              : "border border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
          }`}
        >
          {selected ? "Selected" : "Select as target"}
        </button>
      )}

      {!isTarget && onRequestChange && (
        <button
          onClick={() => onRequestChange(group)}
          disabled={pending}
          className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40"
        >
          {pending ? (
            <>
              <Ban className="h-3.5 w-3.5" />
              Request Pending
            </>
          ) : (
            <>
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Request Change
            </>
          )}
        </button>
      )}
    </article>
  );
}
