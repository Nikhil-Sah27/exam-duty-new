import { Building2, Calendar, Clock, DoorOpen, Tag, Users, X } from "lucide-react";
import type {
  ExamRoomAssignment,
  ExamSchedule,
} from "@/modules/shared/exams/types/exam.types";
import CourseSummary from "@/modules/shared/exams/components/CourseSummary";
import AssignmentStatusBadge from "@/modules/shared/components/AssignmentStatusBadge";
import type { TeacherAssignmentStatus } from "@/modules/shared/utils/assignmentStatusUtils";
import Section from "./Section";
import { deptColor, formatDate, formatTime } from "./examDetailsModalUtils";

// Header gradient mirrors the dashboard hero — same blue/indigo/violet
// family used for DCS and RS heroes so all teacher surfaces feel unified.
export function ModalHeroHeader({
  room,
  buildingName,
  status,
  onClose,
}: {
  room: ExamRoomAssignment["room"];
  buildingName: string;
  status: TeacherAssignmentStatus;
  onClose: () => void;
}) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-4 text-white">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 rounded-full bg-white/15 p-1 transition-colors hover:bg-white/30"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
          Room
        </span>
        <AssignmentStatusBadge status={status} size="md" />
      </div>
      <h3 className="mt-2 text-xl font-bold">
        {buildingName} — {room.roomNumber}
      </h3>
      <p className="mt-0.5 text-xs text-white/80">
        Floor {room.floor} · Capacity {room.capacity}
      </p>
    </div>
  );
}

// The course block resolves the per-room subject when the schedule carries
// multiple departments — same logic the CS modal uses.
export function CourseSection({
  courses,
  departments,
}: {
  courses: ExamSchedule["courses"];
  departments: string[];
}) {
  return (
    <Section icon={Tag} title="Course">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm">
        <CourseSummary courses={courses} forDepartments={departments} />
      </div>
    </Section>
  );
}

export function ExamDetailsSection({
  schedule,
  departments,
}: {
  schedule: ExamSchedule;
  departments: string[];
}) {
  return (
    <Section icon={Calendar} title="Exam Details">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <Calendar className="h-3 w-3" /> Date
          </p>
          <p className="mt-1 text-sm font-bold text-gray-800">
            {formatDate(schedule.date)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <Clock className="h-3 w-3" /> Time
          </p>
          <p className="mt-1 text-sm font-bold text-gray-800">
            {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <Users className="h-3 w-3" /> Departments
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {departments.length === 0 ? (
              <span className="text-sm text-gray-400">—</span>
            ) : (
              departments.map((d) => (
                <span
                  key={d}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${deptColor(d)}`}
                >
                  {d}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}

export function RoomInformationSection({
  room,
  buildingName,
}: {
  room: ExamRoomAssignment["room"];
  buildingName: string;
}) {
  return (
    <Section icon={DoorOpen} title="Room Information">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <RoomStat icon={<DoorOpen className="h-3 w-3" />} label="Room" value={room.roomNumber} />
        <RoomStat icon={<Users className="h-3 w-3" />} label="Capacity" value={String(room.capacity)} />
        <RoomStat icon={<Building2 className="h-3 w-3" />} label="Floor" value={`Floor ${room.floor}`} />
        <RoomStat icon={<Building2 className="h-3 w-3" />} label="Building" value={buildingName} />
      </div>
    </Section>
  );
}

function RoomStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}
