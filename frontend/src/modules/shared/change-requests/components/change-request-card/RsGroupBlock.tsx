import { Building2, Calendar, Clock, DoorOpen } from "lucide-react";
import {
  formatDate,
  formatTime,
  rsGroupSummary,
} from "./changeRequestCardUtils";

export default function RsGroupBlock({
  label,
  summary,
}: {
  label: string;
  summary: NonNullable<ReturnType<typeof rsGroupSummary>>;
}) {
  return (
    <div className="flex-1 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {label}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
          <Building2 className="h-2.5 w-2.5" />
          RS · Group
        </span>
      </div>
      <div className="space-y-1 text-xs text-gray-600">
        {summary.schedule && (
          <>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-gray-400" />
              {formatDate(summary.schedule.date)}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-gray-400" />
              {formatTime(summary.schedule.startTime)} – {formatTime(summary.schedule.endTime)}
            </div>
          </>
        )}
        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <DoorOpen className="h-3 w-3 text-gray-400" />
          {summary.buildingName} — {summary.rangeLabel}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {summary.roomNumbers.map((rn) => (
          <span
            key={rn}
            className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200"
          >
            {rn}
          </span>
        ))}
      </div>
      {summary.departments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-indigo-100 pt-1.5">
          {summary.departments.map((d) => (
            <span
              key={d}
              className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700"
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
