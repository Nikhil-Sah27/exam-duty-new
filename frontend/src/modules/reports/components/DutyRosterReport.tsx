import { useMemo, useState } from "react";
import {
  DoorOpen,
  Loader2,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import {
  useExamDutyStatus,
  useExamGroupDetails,
  useExamGroups,
} from "@/modules/exams/hooks";
import type { ExamSchedule } from "@/modules/exams/types";
import { useRosterDcsGroups } from "../hooks/useRosterDcsGroups";
import { computeRosterCoverage } from "../utils/rosterCoverage";
import { groupSchedulesByDay } from "../utils/groupSchedulesByDay";
import { exportExamCsv, type ExamMeta } from "../utils/rosterCsv";
import CoverageTile from "./CoverageTile";
import ExamPicker from "./ExamPicker";
import RosterOverview from "./RosterOverview";
import ExportButton from "./ExportButton";
import RosterDaySection from "./RosterDaySection";

const sortSchedules = (schedules: ExamSchedule[]) =>
  [...schedules].sort((a, b) => {
    const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (byDate !== 0) return byDate;
    return a.startTime.localeCompare(b.startTime);
  });

/**
 * The printable/exportable invigilation roster: for a chosen exam, every day's
 * shifts and their rooms with the assigned DCS / RS / Invigilator and contact
 * numbers, vacancies highlighted. Organised day → shift, with CSV export at the
 * exam, day, and shift levels. Reads the SAME `details` + `duty-status`
 * endpoints the Exams screen uses, so the roster can never disagree with it.
 *
 * This component only orchestrates; the grouping, coverage maths, CSV building,
 * and each visual block live in their own modules under `reports/`.
 */
export default function DutyRosterReport() {
  const [groupId, setGroupId] = useState("");
  const { data: groups, isLoading: groupsLoading } = useExamGroups();
  const { data: details, isLoading: detailsLoading } = useExamGroupDetails(groupId);
  const { data: statusMap, isLoading: statusLoading } = useExamDutyStatus(groupId);
  const { data: dcsGroups, isLoading: dcsGroupsLoading } =
    useRosterDcsGroups(groupId);

  const schedules = useMemo(
    () => (details ? sortSchedules(details.schedules) : []),
    [details],
  );

  const days = useMemo(() => groupSchedulesByDay(schedules), [schedules]);

  const meta: ExamMeta | null = useMemo(
    () =>
      details
        ? { examType: details.examType, semester: details.semester }
        : null,
    [details],
  );

  const coverage = useMemo(() => {
    if (!details || !statusMap) return null;
    return computeRosterCoverage(details, statusMap, dcsGroups ?? []);
  }, [details, statusMap, dcsGroups]);

  const loading =
    Boolean(groupId) && (detailsLoading || statusLoading || dcsGroupsLoading);

  const ready = !loading && Boolean(statusMap) && Boolean(meta);

  return (
    <div className="space-y-4">
      {/* Exam picker + whole-exam export */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Exam
        </label>
        <ExamPicker
          groups={groups ?? []}
          value={groupId}
          onChange={setGroupId}
          loading={groupsLoading}
        />

        {ready && statusMap && meta && (
          <div className="ml-auto">
            <ExportButton
              label="Export all"
              variant="primary"
              onClick={() => exportExamCsv(meta, schedules, statusMap)}
            />
          </div>
        )}
      </div>

      {/* No exam picked → institution-wide analytics overview. */}
      {!groupId && <RosterOverview />}

      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Building roster…
        </div>
      )}

      {/* Coverage tiles — role-correct denominators (per room vs per group) */}
      {coverage && !loading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <CoverageTile
            label="Room slots"
            value={`${coverage.rooms}`}
            hint="across all schedules"
            icon={DoorOpen}
            accent="gray"
          />
          <CoverageTile
            label="Invigilators"
            value={`${coverage.invigilator.assigned}/${coverage.invigilator.total}`}
            hint="one per room"
            vacant={coverage.invigilator.total - coverage.invigilator.assigned}
            icon={UserCheck}
            accent="indigo"
          />
          <CoverageTile
            label="RS"
            value={`${coverage.rs.assigned}/${coverage.rs.total}`}
            hint="duty groups"
            vacant={coverage.rs.total - coverage.rs.assigned}
            icon={Users}
            accent="emerald"
          />
          <CoverageTile
            label="DCS"
            value={`${coverage.dcs.assigned}/${coverage.dcs.total}`}
            hint="duty groups"
            vacant={coverage.dcs.total - coverage.dcs.assigned}
            icon={ShieldCheck}
            accent="amber"
          />
        </div>
      )}

      {/* Empty roster (exam selected + ready, but no schedules) */}
      {ready && meta && days.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500">
            This exam has no scheduled shifts yet.
          </p>
        </div>
      )}

      {/* Day → shift roster */}
      {ready && statusMap && meta && days.length > 0 && (
        <div className="space-y-6">
          {days.map((day) => (
            <RosterDaySection
              key={day.date}
              meta={meta}
              day={day}
              statusMap={statusMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
