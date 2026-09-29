import { useParams, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useTeacherDetails } from "../hooks";
import { useTeacherDcsDutyProgress } from "@/modules/duty-calculation/hooks/useDutyProgress";
import DutyFilterBar from "@/modules/shared/duties/components/DutyFilterBar";
import DutyStatusLegend from "@/modules/shared/components/DutyStatusLegend";
import DcsGroupSections from "@/modules/dcs/select-duty/components/DcsGroupSections";
import DcsSelectionPanel from "@/modules/dcs/select-duty/components/DcsSelectionPanel";
import type { DutyFilters } from "@/modules/shared/duties/types";
import AssignDutyTeacherBanner from "./AssignDutyTeacherBanner";
import TargetReachedNotice from "./TargetReachedNotice";
import { useAdminAssignDcsGroups } from "../hooks/useAdminAssignDcsGroups";

/**
 * CS "Assign DCS Duty" wizard — reuses the same `DcsGroupList` +
 * `DcsSelectionPanel` the DCS uses in their own Select Duty page, but scopes
 * conflict analysis to the target teacher and calls the admin-claim endpoint
 * on submit. Selecting a group and confirming creates one duty per room and
 * fires a `duty_assigned` notification for each.
 */
export default function AssignDCSDutyPage() {
  const { id: teacherId } = useParams<{ id: string }>();
  const { data: teacher, isLoading: teacherLoading } = useTeacherDetails(
    teacherId!,
  );
  const { data: progress } = useTeacherDcsDutyProgress(teacherId);

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
    ordinalMap,
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
  } = useAdminAssignDcsGroups(teacherId);

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
        <span className="font-medium text-gray-700">Assign DCS Group</span>
      </nav>

      <AssignDutyTeacherBanner teacher={teacher} progress={progress ?? null} />

      {progress?.reached ? (
        <TargetReachedNotice
          teacherName={teacher.name}
          role="dcs"
          target={progress.target}
          assigned={progress.assigned}
        />
      ) : (
        <>
      <div>
        <h2 className="text-xl font-bold text-gray-800">
          Select a Supervision Group
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Pick one or more DCS supervision groups to assign to {teacher.name}.
          Each group is sized automatically by student count (1 DCS per 300).
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

          <p className="text-xs text-gray-500">
            Showing {filteredGroups.length} of {groups.length} DCS group
            {groups.length !== 1 ? "s" : ""}
          </p>

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
              Failed to load DCS groups. Please try again later.
            </div>
          )}

          {isLoading ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Loading groups...
            </p>
          ) : (
            <DcsGroupSections
              groups={filteredGroups}
              stateOf={stateOf}
              onToggle={tryToggleGroup}
              conflictFor={conflictFor}
              ordinalMap={ordinalMap}
            />
          )}
        </div>

        <div className="lg:col-span-1">
          <DcsSelectionPanel
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
