import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useExamGroupDetails, useExamDutyStatus } from "../hooks";
import { ExamGroupStatus, ExamSchedule } from "../types";
import ExamHeader from "./ExamHeader";
import Timetable from "./Timetable";
import StatusLegend from "./StatusLegend";
import DepartmentFilter from "./DepartmentFilter";

function getStatus(startDate: string, endDate: string): ExamGroupStatus {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (now < start) return "upcoming";
  if (now > end) return "completed";
  return "ongoing";
}

/**
 * Keep only rooms whose `departments` list includes `dept`. Schedules that
 * end up with zero matching rooms are dropped entirely so the timetable
 * doesn't render empty time slots for an unrelated department.
 */
function filterSchedulesByDepartment(
  schedules: ExamSchedule[],
  dept: string | null,
): ExamSchedule[] {
  if (!dept) return schedules;
  return schedules
    .map((s) => ({
      ...s,
      rooms: (s.rooms || []).filter((r) => r.departments.includes(dept)),
    }))
    .filter((s) => s.rooms.length > 0);
}

export default function ExamDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: group, isLoading } = useExamGroupDetails(id!);
  const { data: dutyStatusMap } = useExamDutyStatus(id!);

  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const availableDepartments = useMemo<string[]>(() => {
    if (!group) return [];
    // Prefer the pre-aggregated list from the API; fall back to a scan over
    // every room so filtering still works on responses that didn't include it.
    if (group.departments && group.departments.length > 0) {
      return [...group.departments].sort();
    }
    const set = new Set<string>();
    for (const s of group.schedules || []) {
      for (const r of s.rooms || []) {
        for (const d of r.departments || []) set.add(d);
      }
    }
    return [...set].sort();
  }, [group]);

  const visibleSchedules = useMemo(
    () => filterSchedulesByDepartment(group?.schedules || [], selectedDept),
    [group?.schedules, selectedDept],
  );

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!group) return <p className="text-red-600">Exam group not found.</p>;

  const status = getStatus(group.startDate, group.endDate);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-400">
        <Link
          to="/exams"
          className="transition-colors hover:text-gray-700"
        >
          Exams
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-700">
          {group.examType} — Semester {group.semester}
        </span>
      </nav>

      {/* Header */}
      <ExamHeader group={group} status={status} />

      {/* Duty Status Legend + Department Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusLegend />
        <DepartmentFilter
          available={availableDepartments}
          selected={selectedDept}
          onChange={setSelectedDept}
        />
      </div>

      {/* Timetable with duty status */}
      {selectedDept && visibleSchedules.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500">
            No rooms scheduled for <span className="font-semibold">{selectedDept}</span> in this exam.
          </p>
        </div>
      ) : (
        <Timetable
          schedules={visibleSchedules}
          dutyStatusMap={dutyStatusMap}
        />
      )}
    </div>
  );
}
