import { useState } from "react";
import { Clock, DoorOpen } from "lucide-react";
import { useAuthStore } from "@/shared/store/auth.store";
import type {
  ExamSchedule,
  DutyStatusMap,
  Duty,
} from "@/modules/shared/exams/types/exam.types";
import { getDutyStatus } from "@/modules/shared/exams/utils/dutyStatusUtils";
import {
  hasTimeConflictForSlot,
  isMyDutyInRoom,
} from "@/modules/shared/exams/utils/examStatusUtils";
import type { OperationalRoleKey } from "@/modules/shared/utils/assignmentStatusUtils";
import InvigilatorRoomChip from "./InvigilatorRoomChip";
import InvigilatorExamDetailsModal from "./InvigilatorExamDetailsModal";

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

interface InvigilatorTimeSlotCardProps {
  schedule: ExamSchedule;
  dutyStatusMap?: DutyStatusMap;
  myDuties: Duty[];
}

export default function InvigilatorTimeSlotCard({
  schedule,
  dutyStatusMap,
  myDuties,
}: InvigilatorTimeSlotCardProps) {
  const rooms = schedule.rooms || [];
  const [selectedRoomIdx, setSelectedRoomIdx] = useState<number | null>(null);
  const userRole = useAuthStore((s) => s.user?.activeRole);
  const viewerRole = (userRole as OperationalRoleKey) || "invigilator";

  const selectedRoom = selectedRoomIdx !== null ? rooms[selectedRoomIdx] : null;
  const selectedFlags =
    selectedRoom && dutyStatusMap ? dutyStatusMap[selectedRoom._id] : undefined;
  const isMine = selectedRoom
    ? isMyDutyInRoom(
        myDuties,
        schedule.date,
        schedule.startTime,
        schedule.endTime,
        selectedRoom.room.roomNumber,
        selectedRoom.room._id,
        viewerRole
      )
    : false;

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-800">
              {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <DoorOpen className="h-3.5 w-3.5" />
            {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
          </div>
        </div>

        {rooms.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r, idx) => {
              const flags = dutyStatusMap?.[r._id];
              const mine = isMyDutyInRoom(
                myDuties,
                schedule.date,
                schedule.startTime,
                schedule.endTime,
                r.room.roomNumber,
                r.room._id,
                viewerRole,
              );
              // Conflict = a real overlap with another duty the viewer holds
              // (any role — one person, one place). Skipped only when this exact
              // slot is already MINE for this role (handled above).
              const conflict =
                !mine &&
                hasTimeConflictForSlot(
                  myDuties,
                  schedule.date,
                  schedule.startTime,
                  schedule.endTime,
                  r.room.roomNumber,
                  r.room._id,
                  viewerRole,
                );
              return (
                <InvigilatorRoomChip
                  key={r._id}
                  assignment={r}
                  flags={flags}
                  viewerRole={viewerRole}
                  isMine={mine}
                  hasConflict={conflict}
                  onClick={() => setSelectedRoomIdx(idx)}
                />
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-400">No rooms assigned yet.</p>
        )}
      </div>

      {selectedRoom && (
        <InvigilatorExamDetailsModal
          open={selectedRoomIdx !== null}
          onClose={() => setSelectedRoomIdx(null)}
          assignment={selectedRoom}
          schedule={schedule}
          dutyFlags={selectedFlags}
          status={getDutyStatus(selectedFlags)}
          isMine={isMine}
        />
      )}
    </>
  );
}
