import { Calendar, Clock, Crown, DoorOpen } from "lucide-react";
import type { DcsGroupRef } from "../../types/changeRequest.types";
import { formatDate, formatTime } from "./changeRequestCardUtils";

export default function DcsGroupBlock({
  label,
  group,
}: {
  label: string;
  group: DcsGroupRef;
}) {
  return (
    <div className="flex-1 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {label}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
          <Crown className="h-2.5 w-2.5" />
          Group #{group.groupIndex}
        </span>
      </div>
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 text-gray-400" />
          {formatDate(group.schedule.date)}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-gray-400" />
          {formatTime(group.schedule.startTime)} – {formatTime(group.schedule.endTime)}
        </div>
      </div>
      <div className="mt-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Rooms ({group.assignedRooms.length})
        </p>
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
        <div className="mt-2 flex flex-wrap gap-1 border-t border-blue-100 pt-1.5">
          {group.assignedDepartments.map((d) => (
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
