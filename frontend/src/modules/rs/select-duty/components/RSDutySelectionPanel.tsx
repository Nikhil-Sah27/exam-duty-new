import { useState } from "react";
import {
  Calendar,
  Clock,
  Layers,
  DoorOpen,
  Send,
  Loader2,
  X,
} from "lucide-react";
import type { RSDutyGroup } from "../types";
import {
  totalHours,
  uniqueUpcomingDates,
} from "@/modules/shared/duties/utils/dutyDurationUtils";
import { totalRoomCount } from "../utils/rsDutyGroupingUtils";
import ConfirmActionModal from "@/shared/components/ConfirmActionModal";

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

interface SubmitResult {
  group: RSDutyGroup;
  ok: boolean;
  error?: string;
}

interface RSDutySelectionPanelProps {
  selected: RSDutyGroup[];
  onRemove: (groupId: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  results?: SubmitResult[];
}

/**
 * Right-rail summary for the RS Select Duty page. Spec-aligned content:
 *
 *   Selected Groups   — list of "Building — Rooms a–b"
 *   Total Rooms       — sum across all groups (one RS supervises N rooms)
 *   Total Duty Slots  — number of groups selected
 *
 * Reuses `totalHours`/`uniqueUpcomingDates` from shared so the tile math
 * stays in lockstep with invigilator's panel.
 */
export default function RSDutySelectionPanel({
  selected,
  onRemove,
  onClear,
  onSubmit,
  isSubmitting,
  results,
}: RSDutySelectionPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hours = totalHours(selected);
  const dates = uniqueUpcomingDates(selected);
  const rooms = totalRoomCount(selected);
  const failures = results?.filter((r) => !r.ok) || [];
  const successes = results?.filter((r) => r.ok) || [];

  const handleConfirm = () => {
    setConfirmOpen(false);
    onSubmit();
  };

  return (
    <aside className="sticky top-20 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Your Selection
        </p>
        <h3 className="mt-1 text-lg font-bold text-gray-800">
          {selected.length} group{selected.length !== 1 ? "s" : ""} selected
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-center">
        <div>
          <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">
            <Layers className="h-3 w-3" /> Groups
          </p>
          <p className="mt-0.5 text-sm font-bold text-gray-700">{selected.length}</p>
        </div>
        <div>
          <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">
            <DoorOpen className="h-3 w-3" /> Rooms
          </p>
          <p className="mt-0.5 text-sm font-bold text-gray-700">{rooms}</p>
        </div>
        <div>
          <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">
            <Clock className="h-3 w-3" /> Hours
          </p>
          <p className="mt-0.5 text-sm font-bold text-gray-700">{hours.toFixed(1)}</p>
        </div>
      </div>

      {dates.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            <Calendar className="h-3 w-3" /> Upcoming
          </p>
          <div className="flex flex-wrap gap-1">
            {dates.slice(0, 6).map((d) => (
              <span
                key={d}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
              >
                {formatDateShort(d)}
              </span>
            ))}
            {dates.length > 6 && (
              <span className="text-[10px] text-gray-400">+{dates.length - 6}</span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {selected.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
            No groups selected. Pick a room group on the left.
          </p>
        ) : (
          selected.map((g) => (
            <div
              key={g.groupId}
              className="flex items-start justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-gray-800 px-1 py-0.5 text-[9px] font-bold text-white">
                    {g.examType}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-700">
                    Sem {g.semester}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-700">
                  {g.buildingName} {g.rangeLabel.replace(/^Rooms?\s/, "")}
                </p>
                <p className="text-[10px] text-gray-500">
                  {formatDateShort(g.date)} · {g.startTime}–{g.endTime} ·{" "}
                  {g.rooms.length} room{g.rooms.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => onRemove(g.groupId)}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-blue-100 hover:text-red-500"
                aria-label="Remove from selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={selected.length === 0 || isSubmitting}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" /> Confirm Selection
            </>
          )}
        </button>
        {selected.length > 0 && !isSubmitting && (
          <button
            onClick={onClear}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            Clear all
          </button>
        )}
      </div>

      {results && results.length > 0 && (
        <div className="space-y-1 border-t border-gray-100 pt-3 text-xs">
          {successes.length > 0 && (
            <p className="rounded-lg bg-green-50 px-2 py-1.5 text-green-700">
              {successes.length} group{successes.length !== 1 ? "s" : ""} assigned successfully.
            </p>
          )}
          {failures.map((r) => (
            <p
              key={r.group.groupId}
              className="rounded-lg bg-red-50 px-2 py-1.5 text-red-700"
            >
              {r.group.rangeLabel}: {r.error || "Failed."}
            </p>
          ))}
        </div>
      )}

      <ConfirmActionModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Claim these RS groups?"
        description={
          <>
            You're about to claim{" "}
            <span className="font-semibold text-gray-800">
              {selected.length} RS group{selected.length === 1 ? "" : "s"}
            </span>{" "}
            covering{" "}
            <span className="font-semibold text-gray-800">
              {rooms} room{rooms === 1 ? "" : "s"}
            </span>
            . Once assigned, changes require a change request.
          </>
        }
        confirmLabel={`Claim ${selected.length} group${selected.length === 1 ? "" : "s"}`}
        isLoading={isSubmitting}
      />
    </aside>
  );
}
