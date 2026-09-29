import {
  Building2,
  Calendar,
  Clock,
  DoorOpen,
  CheckCircle2,
} from "lucide-react";
import type { RSUpcomingGroup } from "../utils/rsUpcomingGrouping";
import { getTypeColor } from "@/modules/shared/exams/utils/examStatusUtils";
import { formatTime } from "@/modules/shared/duties/utils/upcomingDutyUtils";

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

function getDeptColor(d: string): string {
  return DEPT_COLORS[d.toUpperCase()] || "bg-gray-100 text-gray-600";
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

interface RSUpcomingGroupCardProps {
  group: RSUpcomingGroup;
  onClick: (group: RSUpcomingGroup) => void;
}

/**
 * A single RS group tile on the Upcoming Duties page. Shows the aggregated
 * building + range + room chips instead of individual rooms — mirrors the
 * grouping used on Select Duty so what the RS selected is what they see.
 */
export default function RSUpcomingGroupCard({
  group,
  onClick,
}: RSUpcomingGroupCardProps) {
  const typeColor = getTypeColor(group.examType);

  return (
    <button
      onClick={() => onClick(group)}
      className="group flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${typeColor}`}
            >
              {group.examType}
            </span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
              Sem {group.semester}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              <Building2 className="h-2.5 w-2.5" />
              RS · Group
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-gray-800">
            {group.buildingName} — {group.rangeLabel}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> Assigned
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          {formatTime(group.startTime)} – {formatTime(group.endTime)}
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          {formatShortDate(group.date)}
        </div>
        <div className="col-span-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
          {group.rooms.length} room{group.rooms.length === 1 ? "" : "s"} in{" "}
          {group.buildingName}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {group.rooms.map((r) => (
          <span
            key={r.dutyId}
            className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
            title={
              r.floor !== undefined && r.capacity !== undefined
                ? `Floor ${r.floor} · Cap ${r.capacity}`
                : undefined
            }
          >
            {r.roomNumber}
          </span>
        ))}
      </div>

      {group.departments.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-gray-100 pt-2">
          {group.departments.map((d) => (
            <span
              key={d}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getDeptColor(d)}`}
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
