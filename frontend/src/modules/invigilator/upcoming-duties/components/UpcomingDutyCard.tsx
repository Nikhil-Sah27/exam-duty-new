import { Calendar, Clock, DoorOpen, UserCheck } from "lucide-react";
import type { Duty } from "@/modules/duties/types";
import { getTypeColor } from "@/modules/shared/exams/utils/examStatusUtils";
import {
  describeExam,
  describeRoom,
  getDepartments,
  getSemester,
  getExamType,
  formatTime,
} from "@/modules/shared/duties/utils/upcomingDutyUtils";
import UpcomingDutyStatusBadge, {
  type UpcomingDutyStatus,
} from "./UpcomingDutyStatusBadge";

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

interface UpcomingDutyCardProps {
  duty: Duty;
  onClick: (duty: Duty) => void;
}

export default function UpcomingDutyCard({ duty, onClick }: UpcomingDutyCardProps) {
  const examLabel = describeExam(duty);
  const room = describeRoom(duty);
  const depts = getDepartments(duty);
  const examType = String(getExamType(duty));
  const semester = getSemester(duty);
  const typeColor = getTypeColor(examType);
  const status = duty.status as UpcomingDutyStatus;

  return (
    <button
      onClick={() => onClick(duty)}
      className="group flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${typeColor}`}
            >
              {examType}
            </span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
              Sem {semester}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              <UserCheck className="h-2.5 w-2.5" />
              Invigilator
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-gray-800">
            {examLabel}
          </p>
        </div>
        <UpcomingDutyStatusBadge status={status} />
      </header>

      <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-xs">
        <div className="flex items-center gap-1.5 text-gray-600">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          {formatTime(duty.startTime)} – {formatTime(duty.endTime)}
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          {new Date(duty.date).toLocaleDateString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "short",
          })}
        </div>
        <div className="col-span-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
          {room.buildingName} — {room.roomNumber}
          {room.floor !== undefined && room.capacity !== undefined && (
            <span className="text-[11px] font-normal text-gray-400">
              · Floor {room.floor} · Cap {room.capacity}
            </span>
          )}
        </div>
      </div>

      {depts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {depts.map((d) => (
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
