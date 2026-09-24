import { useState } from "react";
import { Trash2, CheckCircle2, XCircle } from "lucide-react";
import type { DcsGroup } from "../types";
import ConfirmActionModal from "@/shared/components/ConfirmActionModal";

interface SubmitResult {
  group: DcsGroup;
  ok: boolean;
  error?: string;
}

interface DcsSelectionPanelProps {
  selected: readonly DcsGroup[];
  onRemove: (groupId: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  results?: SubmitResult[];
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

/**
 * Right-rail panel summarising the DCS groups the user has staged for
 * submission. Hits `/dcs/groups/:id/claim` one-by-one on submit; per-group
 * results are shown inline so partial failures don't lose context.
 */
export default function DcsSelectionPanel({
  selected,
  onRemove,
  onClear,
  onSubmit,
  isSubmitting,
  results,
}: DcsSelectionPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = () => {
    setConfirmOpen(false);
    onSubmit();
  };

  return (
    <div className="sticky top-20 rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50/40 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">Your Selection</h2>
        {selected.length > 0 && (
          <button
            onClick={onClear}
            className="text-[11px] font-medium text-gray-500 hover:text-red-600"
          >
            Clear all
          </button>
        )}
      </div>

      {selected.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 px-3 py-6 text-center">
          <p className="text-xs text-gray-500">
            Tap a DCS group on the left to add it here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {selected.map((g) => {
            const result = results?.find((r) => r.group._id === g._id);
            return (
              <li
                key={g._id}
                className="flex items-start justify-between gap-2 rounded-lg border border-blue-100 bg-white p-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800">
                    {g.examGroup?.examType} · Sem {g.examGroup?.semester} · Group{" "}
                    {g.groupIndex}
                  </p>
                  <p className="mt-0.5 text-[10px] text-gray-500">
                    {formatDate(g.schedule.date)} · {g.schedule.startTime}–
                    {g.schedule.endTime} · {g.assignedRooms.length} rooms ·{" "}
                    {g.assignedStudents} students
                  </p>
                  {result && (
                    <p
                      className={`mt-1 flex items-center gap-1 text-[10px] font-medium ${
                        result.ok ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {result.ok ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Claimed
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" /> {result.error}
                        </>
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRemove(g._id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove from selection"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => setConfirmOpen(true)}
        disabled={selected.length === 0 || isSubmitting}
        className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2.5 text-sm font-bold text-white shadow-md transition-all enabled:hover:from-blue-700 enabled:hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSubmitting
          ? "Claiming..."
          : selected.length === 0
            ? "Pick a group"
            : `Claim ${selected.length} group${selected.length === 1 ? "" : "s"}`}
      </button>

      <ConfirmActionModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Claim these DCS groups?"
        description={
          <>
            You're about to claim{" "}
            <span className="font-semibold text-gray-800">
              {selected.length} DCS group{selected.length === 1 ? "" : "s"}
            </span>
            . Once claimed, changes require a change request.
          </>
        }
        confirmLabel={`Claim ${selected.length} group${selected.length === 1 ? "" : "s"}`}
        isLoading={isSubmitting}
      />
    </div>
  );
}
