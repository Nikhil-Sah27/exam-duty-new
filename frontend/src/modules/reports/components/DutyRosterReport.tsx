import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  useExamDutyStatus,
  useExamGroupDetails,
  useExamGroups,
} from "@/modules/exams/hooks";
import type {
  AssigneePublic,
  DutyStatusMap,
  ExamRoomAssignment,
  ExamSchedule,
} from "@/modules/exams/types";
import { formatDate } from "@/shared/lib/utils";
import { downloadCsv } from "@/shared/lib/csv";

const ROLES = [
  { key: "invigilatorTeacher", flag: "invigilatorAssigned", label: "Invigilator" },
  { key: "rsTeacher", flag: "rsAssigned", label: "RS" },
  { key: "dcsTeacher", flag: "dcsAssigned", label: "DCS" },
] as const;

const roomLabel = (r: ExamRoomAssignment) =>
  `${r.room.building?.name ?? "—"} · ${r.room.roomNumber}`;

const sortRooms = (rooms: ExamRoomAssignment[]) =>
  [...rooms].sort((a, b) => {
    const byBuilding = (a.room.building?.name ?? "").localeCompare(b.room.building?.name ?? "");
    if (byBuilding !== 0) return byBuilding;
    return a.room.roomNumber.localeCompare(b.room.roomNumber, undefined, { numeric: true });
  });

const sortSchedules = (schedules: ExamSchedule[]) =>
  [...schedules].sort((a, b) => {
    const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (byDate !== 0) return byDate;
    return a.startTime.localeCompare(b.startTime);
  });

/**
 * The printable/exportable invigilation roster: for a chosen exam, every
 * schedule's rooms with the assigned DCS / RS / Invigilator and their phone
 * numbers, vacancies highlighted. Reads the SAME `details` + `duty-status`
 * endpoints the Exams screen uses, so the roster can never disagree with it.
 */
export default function DutyRosterReport() {
  const [groupId, setGroupId] = useState("");
  const { data: groups, isLoading: groupsLoading } = useExamGroups();
  const { data: details, isLoading: detailsLoading } = useExamGroupDetails(groupId);
  const { data: statusMap, isLoading: statusLoading } = useExamDutyStatus(groupId);

  const schedules = useMemo(
    () => (details ? sortSchedules(details.schedules) : []),
    [details]
  );

  const coverage = useMemo(() => {
    if (!schedules.length || !statusMap) return null;
    const tally = { rooms: 0, invigilator: 0, rs: 0, dcs: 0 };
    for (const s of schedules) {
      for (const r of s.rooms) {
        tally.rooms += 1;
        const flags = statusMap[r._id];
        if (flags?.invigilatorAssigned) tally.invigilator += 1;
        if (flags?.rsAssigned) tally.rs += 1;
        if (flags?.dcsAssigned) tally.dcs += 1;
      }
    }
    return tally;
  }, [schedules, statusMap]);

  const exportCsv = () => {
    if (!details || !statusMap) return;
    const rows: (string | null)[][] = [];
    for (const s of schedules) {
      for (const r of sortRooms(s.rooms)) {
        const flags = statusMap[r._id];
        rows.push([
          formatDate(s.date),
          `${s.startTime}–${s.endTime}`,
          r.room.building?.name ?? "",
          r.room.roomNumber,
          flags?.invigilatorTeacher?.name ?? "VACANT",
          flags?.invigilatorTeacher?.phone ?? "",
          flags?.rsTeacher?.name ?? "VACANT",
          flags?.rsTeacher?.phone ?? "",
          flags?.dcsTeacher?.name ?? "VACANT",
          flags?.dcsTeacher?.phone ?? "",
        ]);
      }
    }
    downloadCsv(
      `duty-roster-${details.examType}-sem${details.semester}.csv`,
      ["Date", "Time", "Building", "Room", "Invigilator", "Invigilator Phone", "RS", "RS Phone", "DCS", "DCS Phone"],
      rows
    );
  };

  const loading = Boolean(groupId) && (detailsLoading || statusLoading);

  return (
    <div className="space-y-4">
      {/* Exam picker + export */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Exam
        </label>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="min-w-64 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
        >
          <option value="">
            {groupsLoading ? "Loading exams…" : "Select an exam"}
          </option>
          {(groups ?? []).map((g) => (
            <option key={g._id} value={g._id}>
              {g.examType} — Sem {g.semester} ({formatDate(g.startDate)} – {formatDate(g.endDate)})
            </option>
          ))}
        </select>

        {groupId && details && statusMap && (
          <button
            onClick={exportCsv}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        )}
      </div>

      {!groupId && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500">
            Select an exam to see its full invigilation roster.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Building roster…
        </div>
      )}

      {/* Coverage tiles */}
      {coverage && !loading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <CoverageTile label="Room slots" value={`${coverage.rooms}`} hint="across all schedules" />
          <CoverageTile
            label="Invigilators"
            value={`${coverage.invigilator}/${coverage.rooms}`}
            vacant={coverage.rooms - coverage.invigilator}
          />
          <CoverageTile
            label="RS"
            value={`${coverage.rs}/${coverage.rooms}`}
            vacant={coverage.rooms - coverage.rs}
          />
          <CoverageTile
            label="DCS"
            value={`${coverage.dcs}/${coverage.rooms}`}
            vacant={coverage.rooms - coverage.dcs}
          />
        </div>
      )}

      {/* Per-schedule roster tables */}
      {!loading &&
        statusMap &&
        schedules.map((s) => (
          <ScheduleRoster key={s._id} schedule={s} statusMap={statusMap} />
        ))}
    </div>
  );
}

function CoverageTile({
  label,
  value,
  hint,
  vacant,
}: {
  label: string;
  value: string;
  hint?: string;
  vacant?: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
        {label}
      </span>
      <p className="mt-1 text-2xl font-extrabold text-gray-800">{value}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
      {vacant !== undefined && (
        <p className={`text-[11px] ${vacant > 0 ? "font-semibold text-amber-600" : "text-emerald-600"}`}>
          {vacant > 0 ? `${vacant} vacant` : "Fully staffed"}
        </p>
      )}
    </div>
  );
}

function ScheduleRoster({
  schedule,
  statusMap,
}: {
  schedule: ExamSchedule;
  statusMap: DutyStatusMap;
}) {
  const rooms = sortRooms(schedule.rooms);
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <span className="text-sm font-bold text-gray-800">{formatDate(schedule.date)}</span>
        <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] font-semibold text-white">
          {schedule.startTime} – {schedule.endTime}
        </span>
        <span className="ml-auto text-xs text-gray-400">
          {rooms.length} room{rooms.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="text-xs uppercase tracking-widest text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Room</th>
              {ROLES.map((r) => (
                <th key={r.key} className="px-4 py-2 text-left">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rooms.map((room) => {
              const flags = statusMap[room._id];
              return (
                <tr key={room._id}>
                  <td className="whitespace-nowrap px-4 py-2 font-semibold text-gray-800">
                    {roomLabel(room)}
                  </td>
                  {ROLES.map((r) => (
                    <AssigneeCell key={r.key} assignee={flags?.[r.key] ?? null} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AssigneeCell({ assignee }: { assignee: AssigneePublic | null }) {
  if (!assignee) {
    return (
      <td className="px-4 py-2">
        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
          Vacant
        </span>
      </td>
    );
  }
  return (
    <td className="px-4 py-2">
      <div className="text-gray-800">{assignee.name}</div>
      <div className="text-[11px] text-gray-400">{assignee.phone || assignee.email}</div>
    </td>
  );
}
