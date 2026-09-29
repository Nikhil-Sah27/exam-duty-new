import { Calendar, Clock, DoorOpen } from "lucide-react";
import { formatDate, formatTime } from "./changeRequestCardUtils";

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
    <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1.5 text-gray-600">
          <Calendar className="h-3 w-3 text-gray-400" />
          {formatDate(date)}
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Clock className="h-3 w-3 text-gray-400" />
          {formatTime(startTime)} – {formatTime(endTime)}
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <DoorOpen className="h-3 w-3 text-gray-400" />
          {room}
        </div>
        {examLabel && (
          <p className="truncate text-[10px] text-gray-400">{examLabel}</p>
        )}
      </div>
    </div>
  );
}
