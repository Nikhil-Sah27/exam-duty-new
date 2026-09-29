import { CalendarDays } from "lucide-react";
import type { DutyStatusMap } from "@/modules/exams/types";
import { formatDate } from "@/shared/lib/utils";
import { exportDayCsv, type ExamMeta } from "../utils/rosterCsv";
import type { RosterDay } from "../utils/groupSchedulesByDay";
import ExportButton from "./ExportButton";
import RosterShiftSection from "./RosterShiftSection";

/**
 * One calendar day of the roster: a prominent date header with an "Export day"
 * action, then the day's shifts nested beneath it (indented with a left rail so
 * the day → shift hierarchy is obvious at a glance).
 */
export default function RosterDaySection({
  meta,
  day,
  statusMap,
}: {
  meta: ExamMeta;
  day: RosterDay;
  statusMap: DutyStatusMap;
}) {
  const shiftCount = day.shifts.length;
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 border-l-4 border-l-indigo-500 bg-gradient-to-r from-indigo-50 to-white px-4 py-3 shadow-sm">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800">
            {formatDate(day.date)}
          </p>
          <p className="text-[11px] text-gray-500">
            {shiftCount} shift{shiftCount === 1 ? "" : "s"} · {day.roomCount} room
            {day.roomCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="ml-auto">
          <ExportButton
            label="Export day"
            variant="indigo"
            onClick={() => exportDayCsv(meta, day.date, day.shifts, statusMap)}
          />
        </div>
      </header>

      <div className="space-y-3 md:ml-2 md:border-l-2 md:border-indigo-100 md:pl-4">
        {day.shifts.map((s) => (
          <RosterShiftSection
            key={s._id}
            meta={meta}
            schedule={s}
            statusMap={statusMap}
          />
        ))}
      </div>
    </section>
  );
}
