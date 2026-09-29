import {
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
  AlertTriangle,
  DoorOpen,
  Users,
  Crown,
  Sparkles,
} from "lucide-react";
import DcsRoomChips from "./DcsRoomChips";
import type { ConflictAnalysis } from "@/modules/duties/services/dutyConflictService";
import type { DcsGroup, DcsGroupState } from "../types";

const CONFLICT_TOOLTIP =
  "You already have a duty assigned or selected during this time slot. Please remove the conflicting selection first.";

/**
 * Spec card colors — vibrant gradients, not flat backgrounds. Available =
 * green gradient, Selected = blue gradient, Occupied = gray, Conflict = red.
 * "Mine" is presented as a deep-blue claim badge so it reads as "yours"
 * rather than "yours-but-still-selectable".
 */
const STATE_STYLES: Record<
  DcsGroupState,
  {
    border: string;
    bg: string;
    label: string;
    labelColor: string;
    disabled: boolean;
    glow?: string;
  }
> = {
  AVAILABLE: {
    border: "border-emerald-300",
    // Gradient stops kept to `-50` + `via-white` so the app's dark-mode CSS
    // re-themes every stop; hover feedback comes from `hover:shadow-md` on the
    // card instead of a `-100` gradient that would stay light on dark.
    bg: "bg-gradient-to-br from-emerald-50 via-white to-teal-50",
    label: "Available",
    labelColor: "text-emerald-700",
    disabled: false,
    glow: "shadow-emerald-100",
  },
  SELECTED: {
    border: "border-blue-500 ring-2 ring-blue-200",
    bg: "bg-gradient-to-br from-blue-50 via-white to-indigo-50",
    label: "Selected",
    labelColor: "text-blue-700",
    disabled: false,
    glow: "shadow-blue-100",
  },
  // Occupied + Conflict both paint red per the teacher-perspective palette
  // (green/blue/red — no amber on teacher dashboards).
  OCCUPIED: {
    border: "border-red-300",
    bg: "bg-gradient-to-br from-red-50 via-white to-rose-50 opacity-80 cursor-not-allowed",
    label: "Occupied",
    labelColor: "text-red-700",
    disabled: true,
  },
  MINE: {
    border: "border-blue-400",
    bg: "bg-gradient-to-br from-indigo-50 via-white to-sky-50 cursor-default",
    label: "My Duty",
    labelColor: "text-blue-700",
    disabled: true,
    glow: "shadow-blue-100",
  },
  CONFLICT: {
    border: "border-red-300",
    bg: "bg-gradient-to-br from-red-50 to-rose-50 opacity-80 cursor-not-allowed",
    label: "Time Conflict",
    labelColor: "text-red-700",
    disabled: true,
  },
};

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

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

interface DcsGroupCardProps {
  group: DcsGroup;
  state: DcsGroupState;
  onToggle: () => void;
  /** Conflict analysis when state === CONFLICT — drives tooltip text. */
  conflict?: ConflictAnalysis;
  /**
   * Cross-schedule display number — falls back to the backend per-schedule
   * `groupIndex` if no ordinal was supplied. Surfaces "DCS · Group #N"
   * where N is unique across every group the user can see, so the page
   * isn't full of identical "Group 1" badges.
   */
  displayOrdinal?: number;
}

export default function DcsGroupCard({
  group,
  state,
  onToggle,
  conflict,
  displayOrdinal,
}: DcsGroupCardProps) {
  const styles = STATE_STYLES[state];
  const tooltip =
    state === "CONFLICT" ? conflict?.reason || CONFLICT_TOOLTIP : undefined;

  return (
    <button
      onClick={styles.disabled ? undefined : onToggle}
      disabled={styles.disabled}
      aria-disabled={styles.disabled}
      title={tooltip}
      className={`group/card relative flex flex-col gap-3 overflow-hidden rounded-2xl border-2 p-4 text-left shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed ${styles.border} ${styles.bg} ${styles.glow || ""}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
            {group.examGroup?.examType}
          </span>
          <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 ring-1 ring-gray-200">
            Sem {group.examGroup?.semester}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
            <Crown className="h-2.5 w-2.5" />
            DCS · Group #{displayOrdinal ?? group.groupIndex}
          </span>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold ${styles.labelColor}`}
        >
          {state === "SELECTED" && <CheckCircle2 className="h-3 w-3" />}
          {state === "OCCUPIED" && <Lock className="h-3 w-3" />}
          {state === "MINE" && <Sparkles className="h-3 w-3" />}
          {state === "CONFLICT" && <AlertTriangle className="h-3 w-3" />}
          {styles.label}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-gray-400" />
          {formatDate(group.schedule.date)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-gray-400" />
          {formatTime(group.schedule.startTime)} – {formatTime(group.schedule.endTime)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/60 px-3 py-2 ring-1 ring-white/40">
        <div className="flex items-center gap-1.5">
          <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
          <div className="text-[11px] leading-tight">
            <p className="font-bold text-gray-800">{group.assignedRooms.length}</p>
            <p className="text-[10px] text-gray-500">Rooms</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-gray-400" />
          <div className="text-[11px] leading-tight">
            <p className="font-bold text-gray-800">{group.assignedStudents}</p>
            <p className="text-[10px] text-gray-500">Students</p>
          </div>
        </div>
      </div>

      <DcsRoomChips rooms={group.assignedRooms} />

      {group.assignedDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-white/60 pt-2">
          {group.assignedDepartments.map((d) => (
            <span
              key={d}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getDeptColor(d)}`}
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {state === "OCCUPIED" && group.assignedTeacher && (
        <div
          className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800"
          title={[
            group.assignedTeacher.name,
            "Deputy Chief Superintendent",
            group.assignedTeacher.department || "—",
            group.assignedTeacher.phone || group.assignedTeacher.email || "",
          ]
            .filter(Boolean)
            .join("\n")}
        >
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            <span className="font-semibold uppercase tracking-wider">
              Assigned to
            </span>
            <span className="ml-1 font-semibold">{group.assignedTeacher.name}</span>
            {group.assignedTeacher.department && (
              <span className="ml-1 text-red-700/80">
                · {group.assignedTeacher.department}
              </span>
            )}
          </span>
        </div>
      )}

      {state === "CONFLICT" && (
        <div className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            <span className="font-semibold uppercase tracking-wider">
              Time Conflict
            </span>
            <span className="ml-1">
              — You already have a duty during this date and time.
            </span>
          </span>
        </div>
      )}

      <footer className="mt-auto flex items-center justify-between border-t border-white/60 pt-2">
        <span className="text-[10px] uppercase tracking-wider text-gray-400">
          {state === "MINE"
            ? "Your duty"
            : state === "OCCUPIED"
              ? "Unavailable"
              : state === "CONFLICT"
                ? "Cannot select"
                : "Tap to "}
          {state === "SELECTED" && "remove"}
          {state === "AVAILABLE" && "select"}
        </span>
        {(state === "AVAILABLE" || state === "SELECTED") && (
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold ${
              state === "SELECTED"
                ? "bg-blue-600 text-white"
                : "bg-emerald-600 text-white group-hover/card:bg-emerald-700"
            }`}
          >
            {state === "SELECTED" ? "Selected" : "Select Duty"}
          </span>
        )}
      </footer>
    </button>
  );
}
