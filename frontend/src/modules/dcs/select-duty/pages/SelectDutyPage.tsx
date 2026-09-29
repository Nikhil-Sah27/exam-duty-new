import { Crown } from "lucide-react";
import DutyFilterBar from "@/modules/shared/duties/components/DutyFilterBar";
import type { DutyFilters } from "@/modules/shared/duties/types";
import { useDcsDutySelection } from "../hooks/useDcsDutySelection";
import DcsGroupSections from "../components/DcsGroupSections";
import DcsSelectionPanel from "../components/DcsSelectionPanel";
import DutyStatusLegend from "@/modules/shared/components/DutyStatusLegend";

/**
 * DCS Select Duty page. Same outer layout as the Invigilator/RS pages — 2/3
 * card grid + right-rail selection panel — but the unit of work is a
 * pre-computed DCSGroup (created at exam-creation time). The DutyFilterBar
 * component is reused as-is since DcsFilters matches DutyFilters shape.
 */
export default function SelectDutyPage() {
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
  } = useDcsDutySelection();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-2 backdrop-blur-sm ring-1 ring-white/20">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Select Duty</h1>
            <p className="mt-0.5 text-xs text-white/80">
              Pick a DCS supervision group. Each group covers several rooms in
              one exam slot — sized automatically by total students
              (1&nbsp;DCS per 300).
            </p>
          </div>
        </div>
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
            <p className="py-8 text-center text-sm text-gray-400">Loading groups...</p>
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
    </div>
  );
}
