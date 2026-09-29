import { Clock } from "lucide-react";
import type { DutyStatusMap, ExamSchedule } from "@/modules/exams/types";
import { exportShiftCsv, type ExamMeta } from "../utils/rosterCsv";
import ExportButton from "./ExportButton";
import RosterRoomTable from "./RosterRoomTable";

/**
 * One shift (a single schedule / time window) within a day: a time-stamped
 * header with its own "Export shift" action, followed by the room table.
 */
export default function RosterShiftSection({
  meta,
  schedule,
  statusMap,
}: {
  meta: ExamMeta;
  schedule: ExamSchedule;
  statusMap: DutyStatusMap;
}) {
  const roomCount = schedule.rooms.length;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 border-l-4 border-l-sky-400 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b border-sky-100 bg-sky-50 px-4 py-2.5">
        <Clock className="h-4 w-4 text-sky-500" />
        <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
          {schedule.startTime} – {schedule.endTime}
        </span>
        <span className="text-xs text-gray-500">
          {roomCount} room{roomCount === 1 ? "" : "s"}
        </span>
        <div className="ml-auto">
          <ExportButton
            label="Export shift"
            variant="sky"
            onClick={() => exportShiftCsv(meta, schedule, statusMap)}
          />
        </div>
      </header>
      <RosterRoomTable schedule={schedule} statusMap={statusMap} />
    </div>
  );
}
