import { useState } from "react";
import { Clock, DoorOpen } from "lucide-react";
import type { ExamSchedule, DutyStatusMap } from "../types";
import { getDutyStatus } from "../utils/dutyStatusUtils";
import RoomChip from "./RoomChip";
import DutyStatusModal from "./DutyStatusModal";

interface TimeSlotCardProps {
  schedule: ExamSchedule;
  dutyStatusMap?: DutyStatusMap;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function TimeSlotCard({ schedule, dutyStatusMap }: TimeSlotCardProps) {
  const rooms = schedule.rooms || [];
  const [selectedRoomIdx, setSelectedRoomIdx] = useState<number | null>(null);

  const selectedRoom = selectedRoomIdx !== null ? rooms[selectedRoomIdx] : null;
  const selectedFlags = selectedRoom && dutyStatusMap
    ? dutyStatusMap[selectedRoom._id]
    : undefined;

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {/* Time header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 shadow-sm">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-bold text-blue-700">
              {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <DoorOpen className="h-3.5 w-3.5" />
            {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
          </div>
        </div>

        {/* Room chips */}
        {rooms.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r, idx) => {
              const flags = dutyStatusMap?.[r._id];
              const status = getDutyStatus(flags);
              return (
                <RoomChip
                  key={r._id}
                  assignment={r}
                  status={status}
                  onClick={() => setSelectedRoomIdx(idx)}
                />
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-400">No rooms assigned yet.</p>
        )}
      </div>

      {/* Duty Status Modal */}
      {selectedRoom && (
        <DutyStatusModal
          open={selectedRoomIdx !== null}
          onClose={() => setSelectedRoomIdx(null)}
          assignment={selectedRoom}
          schedule={schedule}
          dutyFlags={selectedFlags}
          status={getDutyStatus(selectedFlags)}
        />
      )}
    </>
  );
}
