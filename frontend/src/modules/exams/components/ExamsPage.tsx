import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { useExamGroups, useDeleteExamGroup } from "../hooks";
import type { ExamGroup } from "../types";
import ExamGrid from "./ExamGrid";
import ExamFilters from "./ExamFilters";
import ConfirmDeleteModal from "@/shared/components/ConfirmDeleteModal";
import { useAvailableDutySlots } from "@/modules/shared/exams/hooks/useSharedExamData";
import {
  getGroupIdsWithStatusOnDate,
  dayMsFromKey,
  getTomorrow,
} from "@/modules/shared/exams/selectors/dashboardSelectors";

/** Query-param → duty status + human label for the deep-link banner. */
const ASSIGNMENT_FILTERS = {
  "not-assigned": { status: "NOT_ASSIGNED" as const, label: "not assigned" },
  partial: { status: "PARTIAL" as const, label: "partially assigned" },
};

function formatBannerDate(dayMs: number): string {
  return new Date(dayMs).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ExamsPage() {
  const { data: groups, isLoading } = useExamGroups();
  const deleteMutation = useDeleteExamGroup();

  const [searchParams, setSearchParams] = useSearchParams();
  const assignmentParam = searchParams.get("assignment") ?? "";
  const assignmentFilter =
    ASSIGNMENT_FILTERS[assignmentParam as keyof typeof ASSIGNMENT_FILTERS];
  // Target date the dashboard chose: explicit `date=YYYY-MM-DD`, or the legacy
  // `when=tomorrow` fallback.
  const dateParam = searchParams.get("date");
  const targetDayMs = dateParam
    ? dayMsFromKey(dateParam)
    : searchParams.get("when") === "tomorrow"
      ? getTomorrow().getTime()
      : null;

  const [filterType, setFilterType] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ExamGroup | null>(null);

  const allGroups = groups || [];

  // Deep-link from the dashboard status cards: narrow to the target date's
  // exams that still have classrooms in the requested status. Reuses the same
  // duty-slot feed + selector the dashboard uses, so counts stay consistent.
  const { data: slots = [], isLoading: slotsLoading } = useAvailableDutySlots();
  let visibleGroups = allGroups;
  if (assignmentFilter && targetDayMs !== null) {
    const ids = getGroupIdsWithStatusOnDate(
      slots,
      assignmentFilter.status,
      targetDayMs,
    );
    visibleGroups = allGroups.filter((g) => ids.has(g._id));
  }

  const clearAssignmentFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("assignment");
    next.delete("when");
    next.delete("date");
    setSearchParams(next, { replace: true });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const filtering = Boolean(assignmentFilter) && targetDayMs !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Exams</h1>
      </div>

      {/* Deep-link context banner */}
      {assignmentFilter && targetDayMs !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-sm text-indigo-800">
            Showing exams on{" "}
            <span className="font-semibold">
              {formatBannerDate(targetDayMs)}
            </span>{" "}
            with <span className="font-semibold">{assignmentFilter.label}</span>{" "}
            classrooms
            {!slotsLoading && (
              <span className="text-indigo-500">
                {" "}
                · {visibleGroups.length}{" "}
                {visibleGroups.length === 1 ? "exam" : "exams"}
              </span>
            )}
            . Open an exam to assign teachers.
          </p>
          <button
            onClick={clearAssignmentFilter}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 transition-colors hover:bg-indigo-100"
          >
            <X className="h-3.5 w-3.5" />
            Clear filter
          </button>
        </div>
      )}

      {/* Filters */}
      {allGroups.length > 0 && (
        <ExamFilters
          selectedType={filterType}
          selectedSemester={filterSemester}
          onTypeChange={setFilterType}
          onSemesterChange={setFilterSemester}
        />
      )}

      {/* Content */}
      {isLoading || (filtering && slotsLoading) ? (
        <p className="text-gray-500">Loading exam groups...</p>
      ) : (
        <ExamGrid
          groups={visibleGroups}
          selectedType={filterType}
          selectedSemester={filterSemester}
          onDelete={(group) => setDeleteTarget(group)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
        title="Delete Exam?"
        message={
          deleteTarget && (
            <>
              <p className="mb-2">
                <span className="font-semibold text-gray-800">
                  {deleteTarget.examType} — Semester {deleteTarget.semester}
                </span>
              </p>
              <p className="mb-2">This will:</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
                <li>delete schedules</li>
                <li>release teacher duties</li>
                <li>free room allocations</li>
                <li>cancel linked change requests</li>
                <li>notify affected staff</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                This action cannot be undone.
              </p>
            </>
          )
        }
      />
    </div>
  );
}
