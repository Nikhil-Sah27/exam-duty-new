import { Calendar, Clock, Crown, DoorOpen, Shield, Users } from "lucide-react";
import type { DutyGroupSummary } from "./duty-group-summary/dutyGroupSummaryTypes";
import {
  deptColor,
  formatDate,
  formatTime,
} from "./duty-group-summary/dutyGroupSummaryUtils";
import {
  AssigneePanel,
  RoomsByBuildingPanel,
  Stat,
} from "./duty-group-summary/DutyGroupSummarySections";

export type { DutyGroupSummary } from "./duty-group-summary/dutyGroupSummaryTypes";
// Role → summary adapters live in the role modules that own those shapes
// (`@/modules/dcs/select-duty/utils/dcsGroupSummary`,
//  `@/modules/rs/select-duty/utils/rsGroupSummary`), so the shared layer stays
// feature-agnostic. Callers build a `DutyGroupSummary` and pass it in.

/**
 * Read-only at-a-glance card for a DCS / RS duty group. Used inside the
 * group details modal and as the embedded panel inside the classroom modal.
 * Picks up the SEE-style gradient hero pattern used elsewhere.
 */
interface DutyGroupSummaryCardProps {
  summary: DutyGroupSummary;
  /** Optional CTA slot (e.g. "Select Group Duty" button). */
  action?: React.ReactNode;
  /** Optional inline note (e.g. conflict explanation). */
  note?: string;
  /** "warn" tints the note red; defaults to neutral. */
  noteTone?: "info" | "warn";
}

export default function DutyGroupSummaryCard({
  summary,
  action,
  note,
  noteTone = "info",
}: DutyGroupSummaryCardProps) {
  const Icon = summary.kind === "DCS" ? Crown : Shield;
  const tonePillClass = summary.isMine
    ? "bg-gradient-to-r from-blue-600 to-indigo-600"
    : summary.isOccupied
      ? "bg-gradient-to-r from-red-500 to-rose-500"
      : "bg-gradient-to-r from-emerald-500 to-teal-500";
  const toneLabel = summary.isMine
    ? "My Group"
    : summary.isOccupied
      ? "Occupied"
      : "Available";

  return (
    <article className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-sm">
      <header className="flex items-start justify-between gap-2 border-b border-blue-100 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              {summary.kind === "DCS"
                ? "Deputy Chief Superintendent"
                : "Room Superintendent"}
            </p>
            <h3 className="text-base font-bold">{summary.title}</h3>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ${tonePillClass}`}
        >
          {toneLabel}
        </span>
      </header>

      <div className="space-y-3 px-4 py-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            icon={<Calendar className="h-3 w-3" />}
            label="Date"
            value={formatDate(summary.date)}
          />
          <Stat
            icon={<Clock className="h-3 w-3" />}
            label="Time"
            value={`${formatTime(summary.startTime)} – ${formatTime(summary.endTime)}`}
          />
          <Stat
            icon={<DoorOpen className="h-3 w-3" />}
            label="Rooms"
            value={String(summary.rooms.length)}
          />
          <Stat
            icon={<Users className="h-3 w-3" />}
            label={summary.kind === "DCS" ? "Students" : "Building"}
            value={
              summary.kind === "DCS"
                ? String(summary.studentCount ?? 0)
                : summary.buildingName
            }
          />
        </div>

        <RoomsByBuildingPanel rooms={summary.rooms} />

        {summary.departments.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {summary.departments.map((d) => (
              <span
                key={d}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${deptColor(d)}`}
              >
                {d}
              </span>
            ))}
          </div>
        )}

        {summary.assignedTo && (
          <AssigneePanel
            assignedTo={summary.assignedTo}
            isMine={summary.isMine}
          />
        )}

        {note && (
          <p
            className={`text-[11px] ${noteTone === "warn" ? "text-red-700" : "text-gray-500"}`}
          >
            {note}
          </p>
        )}

        {action && <div>{action}</div>}
      </div>
    </article>
  );
}
