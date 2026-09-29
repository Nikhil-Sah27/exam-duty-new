import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { DcsDutyGroup } from "@/modules/duties/services/dcsGroupingService";
import {
  useDcsSwapTargets,
  useSubmitDcsSwap,
} from "../hooks/useDcsChangeRequests";
import DcsGroupRequestCard from "./DcsGroupRequestCard";

const formatDate = (s: string): string =>
  new Date(s).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatTime = (t: string): string => {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
};

export interface DcsSwapTargetModalProps {
  open: boolean;
  source: DcsDutyGroup | null;
  /** The DCS's currently-claimed groups — used to filter conflicting targets. */
  myAssignments: DcsDutyGroup[];
  onClose: () => void;
}

/**
 * Pick a target DCS group to swap into. The target list is sourced via the
 * shared dcsGroupingService (open groups only) and further filtered by
 * useDcsSwapTargets to drop conflicts. Selection persists in local state;
 * submitting fires the dcs_swap change request.
 */
export default function DcsSwapTargetModal({
  open,
  source,
  myAssignments,
  onClose,
}: DcsSwapTargetModalProps) {
  const sourceId = source?._id ?? null;
  const targetsQuery = useDcsSwapTargets(sourceId, myAssignments);
  const submit = useSubmitDcsSwap();

  const [selected, setSelected] = useState<DcsDutyGroup | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sort target groups by date so the earliest options surface first. The
  // hook already returns them sorted via buildDcsGroups; this keeps the
  // mapping stable across re-renders if the array reference changes.
  const targets = useMemo(() => targetsQuery.data ?? [], [targetsQuery.data]);

  if (!open || !source) return null;

  const handleSubmit = () => {
    setError(null);
    if (!selected) {
      setError("Pick a target DCS group to swap into.");
      return;
    }
    submit.mutate(
      {
        dcsSourceGroup: source._id,
        dcsTargetGroup: selected._id,
        reason: reason.trim() || "No reason provided.",
      },
      {
        onSuccess: () => {
          setSelected(null);
          setReason("");
          onClose();
        },
        onError: (e) => {
          setError(e instanceof Error ? e.message : "Failed to submit request.");
        },
      }
    );
  };

  const handleClose = () => {
    setSelected(null);
    setReason("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 text-white">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-1 transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="text-lg font-bold">Swap DCS Duty Group</h3>
          <p className="mt-0.5 text-xs text-white/80">
            Pick an open DCS group to move into. The whole bundle moves together.
          </p>
        </div>

        <div className="max-h-[calc(90vh-9rem)] overflow-y-auto px-6 py-5">
          {/* Source group */}
          <section className="mb-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Current Assignment
            </p>
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 px-3 py-2.5">
              <div className="text-xs text-gray-600">
                {formatDate(source.schedule.date)} ·{" "}
                {formatTime(source.schedule.startTime)} –{" "}
                {formatTime(source.schedule.endTime)}
              </div>
              <p className="mt-1 text-[11px] font-semibold text-gray-700">
                DCS Duty Group #{source.groupIndex} ·{" "}
                {source.assignedRooms.length}{" "}
                {source.assignedRooms.length === 1 ? "room" : "rooms"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {source.assignedRooms.map((er) => (
                  <span
                    key={er._id}
                    className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200"
                  >
                    {er.room.roomNumber}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Target list */}
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Available DCS Groups
            </p>

            {targetsQuery.isLoading && (
              <p className="py-4 text-center text-sm text-gray-400">
                Loading available groups...
              </p>
            )}

            {!targetsQuery.isLoading && targets.length === 0 && (
              <p className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400">
                No open DCS groups available right now (all claimed, in the past,
                or conflicting with your other duties).
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {targets.map((g) => (
                <DcsGroupRequestCard
                  key={g._id}
                  group={g}
                  variant="target"
                  selected={selected?._id === g._id}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </section>

          <section className="mt-5">
            <label
              htmlFor="dcs-swap-reason"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-gray-400"
            >
              Reason (optional)
            </label>
            <textarea
              id="dcs-swap-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. need to attend departmental meeting"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </section>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-3">
          <button
            onClick={handleClose}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selected || submit.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40"
          >
            {submit.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...
              </>
            ) : (
              "Submit Swap Request"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
