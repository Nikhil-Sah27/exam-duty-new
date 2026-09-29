import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import DutyFilterBar from "@/modules/shared/duties/components/DutyFilterBar";
import { useRSDutySelection } from "../hooks/useRSDutySelection";
import RSDutyGroupSections from "../components/RSDutyGroupSections";
import RSDutySelectionPanel from "../components/RSDutySelectionPanel";
import DutyStatusLegend from "@/modules/shared/components/DutyStatusLegend";
import type { DutyFilters } from "@/modules/shared/duties/types";

type ViewMode = "grid" | "table";

/**
 * RS Select Duty page. Same outer layout as the invigilator's page (header
 * with grid/table toggle, 2/3 split with selection panel on the right) but
 * the unit of work is a **room group**, not a single room.
 *
 * The filter bar is reused as-is — its keys (date, examType, semester,
 * department) are role-agnostic and `DutyFilters` matches `RSDutyFilters`
 * shape exactly, so the same component drives both pages.
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
  } = useRSDutySelection();

  const [view, setView] = useState<ViewMode>("grid");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Select Duty</h1>
          <p className="mt-1 text-sm text-gray-500">
            Choose room groups to supervise. Each group covers up to 5 rooms in
            the same block, exam, and time slot.
          </p>
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
            <p className="py-8 text-center text-sm text-gray-400">Loading groups...</p>
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
    </div>
  );
}
