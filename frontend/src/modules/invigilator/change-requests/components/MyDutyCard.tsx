import { Calendar, Clock, DoorOpen, ArrowLeftRight, Ban } from "lucide-react";
import type { Duty } from "@/modules/duties/types";
import { canRequestChange } from "@/modules/shared/change-requests/utils/changeRequestValidation";
import {
  describeRoom,
  getExamType,
  getSemester,
} from "@/modules/shared/duties/utils/upcomingDutyUtils";

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

interface MyDutyCardProps {
  duty: Duty;
  pending: boolean;
  onRequestChange: (duty: Duty) => void;
}

export default function MyDutyCard({ duty, pending, onRequestChange }: MyDutyCardProps) {
  const eligibility = canRequestChange(duty);
  const blocked = !eligibility.ok || pending;

  const { roomNumber, buildingName } = describeRoom(duty);
  const hasBuilding = buildingName && buildingName !== "—";
  const roomLabel = hasBuilding ? `${buildingName} — ${roomNumber}` : roomNumber;
  const examType = getExamType(duty);
  const semester = getSemester(duty);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          {formatDate(duty.date)}
          <span className="text-gray-300">·</span>
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          {formatTime(duty.startTime)} – {formatTime(duty.endTime)}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <DoorOpen className="h-4 w-4 text-gray-400" />
          {roomLabel}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {examType !== "—" && (
            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
              {examType}
            </span>
          )}
          {semester !== "—" && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
              Sem {semester}
            </span>
          )}
          {duty.exam?.name && (
            <span className="text-xs text-gray-500">{duty.exam.name}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => onRequestChange(duty)}
          disabled={blocked}
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
        {!pending && !eligibility.ok && eligibility.reason && (
          <p className="text-[10px] text-gray-400">{eligibility.reason}</p>
        )}
      </div>
    </article>
  );
}
