import { Clock, CheckCircle2, Inbox } from "lucide-react";
import { StatusBadge } from "@/shared/components";
import { formatDate, capitalize } from "@/shared/lib/utils";
import type { Duty } from "@/modules/duties/types";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";

interface DutySectionProps {
  title: string;
  variant: "upcoming" | "completed";
  duties: Duty[];
  /** CS only — adds an Unassign action to duties that haven't happened yet. */
  onUnassign?: (duty: Duty) => void;
}

/**
 * Duty rows need an exam label + subtitle regardless of which creation flow
 * produced them. Legacy duties carry a populated `exam` document; new duties
 * (visual CS assign flow, invigilator self-assign, etc.) carry `examSchedule
 * + examRoom` refs instead. Reading `d.exam.name` directly on a new-flow
 * duty crashes the whole page — this helper is what makes the row survive.
 */
function getExamLabel(d: Duty): { title: string; subtitle: string } {
  if (d.exam) {
    return {
      title: d.exam.name,
      subtitle: `${d.exam.department} — Sem ${d.exam.semester}`,
    };
  }
  const group = d.examSchedule?.examGroup;
  const depts = d.examRoom?.departments ?? [];
  const title = group ? `${group.examType} — Sem ${group.semester}` : "Exam";
  const subtitle = depts.length > 0 ? depts.join(", ") : "—";
  return { title, subtitle };
}

/**
 * Room labels also differ: legacy duties store just the room number as a
 * plain string in `d.room`. New-flow duties populate `examRoom.room.building`
 * so we can show "Building — 301" instead of a bare "301".
 */
function getRoomLabel(d: Duty): string {
  const room = d.examRoom?.room;
  if (room?.building?.name && room.roomNumber) {
    return `${room.building.name} — ${room.roomNumber}`;
  }
  return d.room || "—";
}

export default function DutySection({
  title,
  variant,
  duties,
  onUnassign,
}: DutySectionProps) {
  const showActions = !!onUnassign && variant === "upcoming";
  const Icon = variant === "upcoming" ? Clock : CheckCircle2;
  const iconColor =
    variant === "upcoming" ? "text-blue-600" : "text-green-600";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h3 className="text-sm font-semibold text-gray-700">
          {title}
        </h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          {duties.length}
        </span>
      </div>

      {/* Content */}
      {duties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Inbox className="mb-2 h-10 w-10 text-gray-300" />
          <p className="text-sm">No {title.toLowerCase()} found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50/50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Exam</th>
                <th className="px-5 py-3">Room</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Status</th>
                {showActions && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {duties.map((d) => {
                const label = getExamLabel(d);
                return (
                <tr key={d._id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">
                      {label.title}
                    </div>
                    <div className="text-xs text-gray-400">
                      {label.subtitle}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{getRoomLabel(d)}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {formatDate(d.date)}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {d.startTime}–{d.endTime}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      label={capitalize(d.status)}
                      variant={
                        d.status === "assigned"
                          ? "blue"
                          : d.status === "completed"
                            ? "green"
                            : "gray"
                      }
                    />
                    {d.status === "assigned" && d.confirmedAt === null && variant === "upcoming" && (
                      <span className="ml-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                        Awaiting confirmation
                      </span>
                    )}
                  </td>
                  {showActions && (
                    <td className="px-5 py-3 text-right">
                      {d.status === "assigned" && isDutyUpcoming(d.date, d.endTime) && (
                        <button
                          type="button"
                          onClick={() => onUnassign?.(d)}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          Unassign
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
