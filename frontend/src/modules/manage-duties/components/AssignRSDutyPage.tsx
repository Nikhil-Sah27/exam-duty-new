import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, LayoutGrid, List } from "lucide-react";
import { useTeacherDetails } from "../hooks";
import { useTeacherRsDutyProgress } from "@/modules/duty-calculation/hooks/useDutyProgress";
import DutyFilterBar from "@/modules/shared/duties/components/DutyFilterBar";
import DutyStatusLegend from "@/modules/shared/components/DutyStatusLegend";
import RSDutyGroupSections from "@/modules/rs/select-duty/components/RSDutyGroupSections";
import RSDutySelectionPanel from "@/modules/rs/select-duty/components/RSDutySelectionPanel";
import type { DutyFilters } from "@/modules/shared/duties/types";
import AssignDutyTeacherBanner from "./AssignDutyTeacherBanner";
import TargetReachedNotice from "./TargetReachedNotice";
import { useAdminAssignRSGroups } from "../hooks/useAdminAssignRSGroups";

type ViewMode = "grid" | "table";

/**
 * CS "Assign RS Duty" wizard — renders the same RS group grid the RS uses
 * in their own Select Duty page, but scoped to a specific target teacher.
 * Selecting a group and confirming calls `/duties/admin-assign-group`, which
 * creates one duty per room in the group and notifies the teacher.
 *
 * Kept visually aligned with the RS-side page so a CS familiar with the
 * teacher's view has zero re-learning to do.
 */
export default function AssignRSDutyPage() {
  const { id: teacherId } = useParams<{ id: string }>();
  const { data: teacher, isLoading: teacherLoading } = useTeacherDetails(
    teacherId!,
  );
  const { data: progress } = useTeacherRsDutyProgress(teacherId);

  const {
    groups,
    filteredGroups,
    selected,
    filters,
    feedback,
    conflictSummary,
    availableDepartments,
    isLoading,
    error,
    stateOf,
    conflictFor,
    tryToggleGroup,
    removeGroup,
    clearSelection,
    updateFilter,
    clearFilters,
    submit,
    isSubmitting,
    submitResults,
  } = useAdminAssignRSGroups(teacherId);

  const [view, setView] = useState<ViewMode>("grid");

  if (teacherLoading) return <p className="text-gray-500">Loading...</p>;
  if (!teacher) return <p className="text-red-600">Teacher not found.</p>;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-gray-400">
        <Link
          to="/manage-duties"
          className="transition-colors hover:text-gray-700"
        >
          Manage Duties
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          to={`/manage-duties/${teacher._id}`}
          className="transition-colors hover:text-gray-700"
        >
          {teacher.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-700">Assign RS Group</span>
      </nav>

      <AssignDutyTeacherBanner teacher={teacher} progress={progress ?? null} />

      {progress?.reached ? (
        <TargetReachedNotice
          teacherName={teacher.name}
          role="rs"
          target={progress.target}
          assigned={progress.assigned}
        />
      ) : (
        <>
      <div>
        <h2 className="text-xl font-bold text-gray-800">Select a Room Group</h2>
        <p className="mt-1 text-sm text-gray-500">
          Pick one or more room groups to assign to {teacher.name}. Each group
          covers up to 5 rooms in the same block and time slot.
        </p>
      </div>

      <DutyStatusLegend />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DutyFilterBar
            filters={filters as DutyFilters}
            availableDepartments={availableDepartments}
            onChange={(k, v) => updateFilter(k, v)}
            onClear={clearFilters}
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {filteredGroups.length} of {groups.length} group
              {groups.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-0.5">
              <button
                onClick={() => setView("grid")}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                  view === "grid"
                    ? "bg-gray-800 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <LayoutGrid className="h-3 w-3" /> Grid
              </button>
              <button
                onClick={() => setView("table")}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                  view === "table"
                    ? "bg-gray-800 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <List className="h-3 w-3" /> Table
              </button>
            </div>
          </div>

          {conflictSummary.banner && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {conflictSummary.banner}
            </div>
          )}

          {feedback && !conflictSummary.banner && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {feedback}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Failed to load room groups. Please try again later.
            </div>
          )}

          {isLoading ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Loading groups...
            </p>
          ) : (
            <RSDutyGroupSections
              groups={filteredGroups}
              stateOf={stateOf}
              onToggle={tryToggleGroup}
              conflictFor={conflictFor}
              view={view}
            />
          )}
        </div>

        <div className="lg:col-span-1">
          <RSDutySelectionPanel
            selected={selected}
            onRemove={removeGroup}
            onClear={clearSelection}
            onSubmit={() => submit(selected)}
            isSubmitting={isSubmitting}
            results={submitResults}
          />
        </div>
      </div>
        </>
      )}
    </div>
  );
}
