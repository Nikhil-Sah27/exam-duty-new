import { Calendar, ClipboardList, Clock, DoorOpen } from "lucide-react";
import { formatDate, formatTime } from "./changeRequestCardUtils";

/**
 * Current / requested block for a single invigilator duty. Uses the same card
 * language as the RS and DCS group blocks (bordered tinted card, role chip,
 * room chip) so every role's change request reads consistently — just with one
 * room instead of a group.
 */
export default function DutyBlock({
  label,
  date,
  startTime,
  endTime,
  room,
  examLabel,
}: {
  label: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  examLabel?: string;
}) {
  return (
    <div className="flex-1 rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {label}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
          <ClipboardList className="h-2.5 w-2.5" />
          Invigilator
        </span>
      </div>
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 text-gray-400" />
          {formatDate(date)}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-gray-400" />
          {formatTime(startTime)} – {formatTime(endTime)}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200">
          <DoorOpen className="h-2.5 w-2.5 text-gray-400" />
          {room}
        </span>
      </div>
      {examLabel && (
        <div className="mt-2 border-t border-emerald-100 pt-1.5">
          <span className="truncate text-[10px] text-gray-500">{examLabel}</span>
        </div>
      )}
    </div>
  );
}
