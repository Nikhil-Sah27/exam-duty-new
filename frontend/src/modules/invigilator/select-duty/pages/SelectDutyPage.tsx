import { useMemo, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { useDutySelection } from "../hooks/useDutySelection";
import DutyFilterBar from "@/modules/shared/duties/components/DutyFilterBar";
import DutySlotCard from "../components/DutySlotCard";
import DutySelectionTable from "../components/DutySelectionTable";
import SelectedDutySummary from "../components/SelectedDutySummary";
import DutyStatusLegend from "@/modules/shared/components/DutyStatusLegend";
import { EMPTY_FILTERS } from "../types";

type ViewMode = "grid" | "table";

export default function SelectDutyPage() {
  const {
    slots,
    filteredSlots,
    selected,
    filters,
    feedback,
    conflictFor,
    conflictSummary,
    isLoading,
    error,
    stateOf,
    tryToggleSlot,
    removeSlot,
    clearSelection,
    updateFilter,
    submit,
    isSubmitting,
    submitResults,
  } = useDutySelection();

  const [view, setView] = useState<ViewMode>("grid");

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) {
      for (const d of s.departments) set.add(d.toUpperCase());
    }
    return [...set].sort();
  }, [slots]);

  const clearFilters = () => {
    (Object.keys(EMPTY_FILTERS) as (keyof typeof EMPTY_FILTERS)[]).forEach((k) =>
      updateFilter(k, EMPTY_FILTERS[k])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Select Duty</h1>
          <p className="mt-1 text-sm text-gray-500">
            Choose available duty slots. Conflicting and full slots are blocked.
          </p>
        </div>
      </div>

      <DutyStatusLegend />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DutyFilterBar
            filters={filters}
            availableDepartments={availableDepartments}
            onChange={updateFilter}
            onClear={clearFilters}
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {filteredSlots.length} of {slots.length} slot
              {slots.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-0.5">
              <button
                onClick={() => setView("grid")}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                  view === "grid" ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <LayoutGrid className="h-3 w-3" /> Grid
              </button>
              <button
                onClick={() => setView("table")}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                  view === "table" ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-50"
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
              Failed to load duty slots. Please try again later.
            </div>
          )}

          {isLoading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading slots...</p>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredSlots.map((slot) => (
                <DutySlotCard
                  key={slot.slotId}
                  slot={slot}
                  state={stateOf(slot)}
                  onToggle={() => tryToggleSlot(slot)}
                  conflict={conflictFor(slot)}
                />
              ))}
              {filteredSlots.length === 0 && (
                <div className="col-span-full rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
                  <p className="text-sm font-medium text-gray-600">
                    No available duties to select.
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Completed or unavailable duties are hidden.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <DutySelectionTable
              slots={filteredSlots}
              stateOf={stateOf}
              onToggle={tryToggleSlot}
            />
          )}
        </div>

        <div className="lg:col-span-1">
          <SelectedDutySummary
            selected={selected}
            onRemove={removeSlot}
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
