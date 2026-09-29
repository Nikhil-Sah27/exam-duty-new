import { X, Calendar, Clock, DoorOpen, BookOpen, UserCheck } from "lucide-react";
import type { Duty } from "@/modules/duties/types";
import { getTypeColor } from "@/modules/shared/exams/utils/examStatusUtils";
import {
  describeExam,
  describeRoom,
  getDepartments,
  getSemester,
  getExamType,
  formatLongDate,
  formatTime,
} from "@/modules/shared/duties/utils/upcomingDutyUtils";
import UpcomingDutyStatusBadge, {
  type UpcomingDutyStatus,
} from "./UpcomingDutyStatusBadge";
import { useExamGroupDetails } from "@/modules/shared/exams/hooks/useSharedExamData";
import CourseSummary from "@/modules/shared/exams/components/CourseSummary";

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          {label}
        </p>
        <div className="text-sm text-gray-800">{value}</div>
      </div>
    </div>
  );
}

interface UpcomingDutyModalProps {
  open: boolean;
  duty: Duty | null;
  onClose: () => void;
}

export default function UpcomingDutyModal({ open, duty, onClose }: UpcomingDutyModalProps) {
  // Hook calls must run unconditionally — modal short-circuits below on close.
  const groupId = duty?.examSchedule?.examGroup?._id ?? null;
  const detailsQuery = useExamGroupDetails(open ? groupId : null);

  if (!open || !duty) return null;

  const examLabel = describeExam(duty);
  const room = describeRoom(duty);
  const depts = getDepartments(duty);
  const semester = getSemester(duty);
  const examType = String(getExamType(duty));
  const typeColor = getTypeColor(examType);
  const status = duty.status as UpcomingDutyStatus;

  // Find the schedule course list, scoped to the duty's room's departments
  // so the user sees only the relevant paper (not every dept's paper that
  // happens to share this time slot).
  const matchingSchedule = detailsQuery.data?.schedules?.find(
    (s) => s._id === duty.examSchedule?._id,
  );
  const scheduleCourses = matchingSchedule?.courses;

  // Reporting time = 15 minutes before start. A conventional default; the
  // actual policy can be wired in later via config/backend.
  const reportingTime = (() => {
    const [h, m] = duty.startTime.split(":").map(Number);
    let total = h * 60 + m - 15;
    if (total < 0) total = 0;
    const rh = Math.floor(total / 60);
    const rm = total % 60;
    return formatTime(`${rh.toString().padStart(2, "0")}:${rm.toString().padStart(2, "0")}`);
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${typeColor}`}
              >
                {examType}
              </span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                Sem {semester}
              </span>
              <UpcomingDutyStatusBadge status={status} />
            </div>
            <h3 className="truncate text-base font-semibold text-gray-800">
              {examLabel}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Subject / course block — surfaced up top so the user knows the
              paper before any logistics. Narrowed to the duty room's
              departments. */}
          <CourseSummary courses={scheduleCourses} forDepartments={depts} />

          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-center gap-2 text-blue-700">
              <UserCheck className="h-4 w-4" />
              <span className="text-sm font-bold">Your Assigned Duty</span>
            </div>
            <p className="mt-1 text-xs text-blue-600">Role: Invigilator</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail
              icon={<Calendar className="h-4 w-4" />}
              label="Date"
              value={formatLongDate(duty.date)}
            />
            <Detail
              icon={<Clock className="h-4 w-4" />}
              label="Time"
              value={`${formatTime(duty.startTime)} – ${formatTime(duty.endTime)}`}
            />
            <Detail
              icon={<Clock className="h-4 w-4" />}
              label="Reporting Time"
              value={reportingTime}
            />
            <Detail
              icon={<BookOpen className="h-4 w-4" />}
              label="Departments"
              value={depts.length ? depts.join(", ") : "—"}
            />
            <div className="sm:col-span-2">
              <Detail
                icon={<DoorOpen className="h-4 w-4" />}
                label="Room"
                value={
                  <div>
                    <p className="font-semibold text-gray-800">
                      {room.buildingName} — {room.roomNumber}
                    </p>
                    {(room.floor !== undefined || room.capacity !== undefined) && (
                      <p className="text-xs text-gray-500">
                        {room.floor !== undefined && `Floor ${room.floor}`}
                        {room.floor !== undefined && room.capacity !== undefined && " · "}
                        {room.capacity !== undefined && `Capacity ${room.capacity}`}
                      </p>
                    )}
                  </div>
                }
              />
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Instructions
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Arrive at the room at the reporting time. Carry your faculty ID and
              the official seating plan. Detailed instructions will appear here
              once the controller publishes them.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
