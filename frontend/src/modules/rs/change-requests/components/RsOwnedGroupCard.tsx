import {
  ArrowLeftRight,
  Ban,
  Building2,
  Calendar,
  Clock,
  DoorOpen,
} from "lucide-react";
import type { RSUpcomingGroup } from "@/modules/rs/upcoming-duties/utils/rsUpcomingGrouping";
import { getTypeColor } from "@/modules/shared/exams/utils/examStatusUtils";
import { formatTime } from "@/modules/shared/duties/utils/upcomingDutyUtils";

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface RsOwnedGroupCardProps {
  group: RSUpcomingGroup;
  pending: boolean;
  onRequestChange: (group: RSUpcomingGroup) => void;
}

/**
 * A single RS-owned group on the Change Requests page. The action operates on
 * the whole group — clicking Request Change opens the target picker; approval
 * moves every room in the group atomically.
 */
export default function RsOwnedGroupCard({
  group,
  pending,
  onRequestChange,
}: RsOwnedGroupCardProps) {
  const typeColor = getTypeColor(group.examType);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
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

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            {formatShortDate(group.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            {formatTime(group.startTime)} – {formatTime(group.endTime)}
          </span>
          <span className="flex items-center gap-1.5">
            <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
            {group.rooms.length} room{group.rooms.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          {group.buildingName} — {group.rangeLabel}
        </div>

        <div className="flex flex-wrap gap-1">
          {group.rooms.map((r) => (
            <span
              key={r.dutyId}
              className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
            >
              {r.roomNumber}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          onClick={() => onRequestChange(group)}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
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
        {pending && (
          <p className="text-[10px] text-gray-400">
            One swap per group at a time.
          </p>
        )}
      </div>
    </article>
  );
}
