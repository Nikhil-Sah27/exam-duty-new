import { Link } from "react-router-dom";
import {
  Calendar,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Trash2,
  UserCheck,
} from "lucide-react";
import type { ExamGroup, ExamGroupStatus } from "../types/exam.types";
import { getTypeColor } from "../utils/examStatusUtils";

const STATUS_BADGE: Record<
  ExamGroupStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  ongoing: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "Ongoing",
  },
  upcoming: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    label: "Upcoming",
  },
  completed: {
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
    label: "Completed",
  },
};

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export interface ExamCardProps {
  group: ExamGroup;
  status: ExamGroupStatus;
  /**
   * Link target. Defaults to `group._id` (relative) so the card works under
   * `/exams`, `/invigilator/exams`, `/rs/exams` etc. without each caller having
   * to know its own base path. Pass a function for full control.
   */
  to?: string | ((group: ExamGroup) => string);
  /** Admin-only: when provided, renders the delete button. */
  onDelete?: (group: ExamGroup) => void;
  /** Optional: departments involved (rendered as a small chip strip). */
  departments?: string[];
  /** Optional: assigned-duty count to show on the card. */
  assignedDutyCount?: number;
}

/**
 * Generic exam card used everywhere the system lists exam groups.
 * Renders a premium SEE variant for `examType === "SEE"` and the standard
 * CIE-tinted variant for IA1/IA2/IA3. Field set matches the spec:
 *   Type badge · Sem · Status badge · #Schedules · #Rooms · Date range
 * Departments + Assigned duty count are optional.
 */
export default function ExamCard({
  group,
  status,
  to,
  onDelete,
  departments,
  assignedDutyCount,
}: ExamCardProps) {
  const href =
    typeof to === "function" ? to(group) : to ?? group._id;
  const isSEE = group.examType === "SEE";
  const statusStyle = STATUS_BADGE[status];

  if (isSEE) {
    return (
      <Link
        to={href}
        className="group relative flex flex-col overflow-hidden rounded-xl border-2 border-pink-300 bg-gradient-to-br from-pink-50/70 via-white to-white p-5 shadow-[0_0_0_1px_rgba(236,72,153,0.05)] transition-all hover:border-purple-400 hover:shadow-lg hover:shadow-pink-100"
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600"
          aria-hidden
        />

        <div className="flex items-start justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-pink-500 to-purple-600 px-3 py-1.5 text-sm font-extrabold tracking-wide text-white shadow-sm">
              <GraduationCap className="h-4 w-4" />
              SEE
            </span>
            <span className="rounded-md bg-white px-3 py-1 text-sm font-bold text-purple-700 ring-1 ring-pink-200">
              Sem {group.semester}
            </span>
            <DepartmentChips departments={departments} tone="see" />
          </div>
          <div className="flex items-center gap-1">
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(group);
                }}
                className="rounded-md p-1.5 text-pink-300 opacity-0 transition-all hover:bg-pink-100 hover:text-pink-600 group-hover:opacity-100"
                title="Delete SEE exam"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <ChevronRight className="h-4 w-4 text-pink-300 transition-colors group-hover:text-purple-500" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
            {statusStyle.label}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-purple-500/70">
            External Exam
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-pink-100 pt-4">
          <CardStat
            icon={<ClipboardList className="h-3.5 w-3.5 text-pink-500" />}
            value={group.totalSchedules}
            label="Schedules"
          />
          <CardStat
            icon={<DoorOpen className="h-3.5 w-3.5 text-purple-500" />}
            value={group.totalRooms}
            label="Rooms"
          />
        </div>

        <CardFooter
          startDate={group.startDate}
          endDate={group.endDate}
          assignedDutyCount={assignedDutyCount}
          tone="see"
        />
      </Link>
    );
  }

  // CIE variant — IA1/IA2/IA3
  const typeColor = getTypeColor(group.examType);

  return (
    <Link
      to={href}
      className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded-md px-2.5 py-1 text-xs font-bold tracking-wide text-white ${typeColor}`}
          >
            {group.examType}
          </span>
          <span className="rounded-md bg-gray-100 px-3 py-1 text-sm font-bold text-gray-800">
            Sem {group.semester}
          </span>
          <DepartmentChips departments={departments} tone="cie" />
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(group);
              }}
              className="rounded-md p-1.5 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              title="Delete exam group"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500" />
        </div>
      </div>

      <div className="mt-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
          {statusStyle.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
        <CardStat
          icon={<ClipboardList className="h-3.5 w-3.5 text-blue-500" />}
          value={group.totalSchedules}
          label="Schedules"
        />
        <CardStat
          icon={<DoorOpen className="h-3.5 w-3.5 text-purple-500" />}
          value={group.totalRooms}
          label="Rooms"
        />
      </div>

      <CardFooter
        startDate={group.startDate}
        endDate={group.endDate}
        assignedDutyCount={assignedDutyCount}
        tone="cie"
      />
    </Link>
  );
}

function DepartmentChips({
  departments,
  tone,
}: {
  departments?: string[];
  tone: "cie" | "see";
}) {
  if (!departments || departments.length === 0) return null;

  const chipClass =
    tone === "see"
      ? "rounded-md bg-purple-50 px-2.5 py-1 text-sm font-semibold text-purple-700 ring-1 ring-purple-200"
      : "rounded-md bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700 ring-1 ring-blue-100";

  const MAX_INLINE = 3;
  const shown = departments.slice(0, MAX_INLINE);
  const overflow = departments.length - shown.length;

  return (
    <>
      {shown.map((d) => (
        <span key={d} className={chipClass}>
          {d}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={chipClass}
          title={departments.slice(MAX_INLINE).join(", ")}
        >
          +{overflow}
        </span>
      )}
    </>
  );
}

function CardStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-sm font-bold text-gray-800">{value}</p>
        <p className="text-[10px] text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function CardFooter({
  startDate,
  endDate,
  assignedDutyCount,
  tone,
}: {
  startDate: string;
  endDate: string;
  assignedDutyCount?: number;
  tone: "cie" | "see";
}) {
  const dateColor = tone === "see" ? "text-purple-500/80" : "text-gray-400";
  const optionalColor = tone === "see" ? "text-purple-600/80" : "text-gray-500";

  return (
    <>
      <div className={`mt-3 flex items-center gap-1.5 text-[11px] ${dateColor}`}>
        <Calendar className="h-3 w-3" />
        {formatDateShort(startDate)} – {formatDateShort(endDate)}
      </div>
      {assignedDutyCount != null && (
        <div className={`mt-2 flex flex-wrap items-center gap-3 text-[11px] ${optionalColor}`}>
          <span className="inline-flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            {assignedDutyCount} duties
          </span>
        </div>
      )}
    </>
  );
}
