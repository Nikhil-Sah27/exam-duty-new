import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Loader2, X } from "lucide-react";
import type { RSUpcomingGroup } from "@/modules/rs/upcoming-duties/utils/rsUpcomingGrouping";
import type { RSDutyGroup } from "@/modules/rs/select-duty/types";
import type { Duty } from "@/modules/duties/types";
import { useAvailableRsGroups } from "../hooks/useAvailableRsGroups";
import { useCreateChangeRequest } from "@/modules/shared/change-requests/hooks/useChangeRequests";
import { getTypeColor } from "@/modules/shared/exams/utils/examStatusUtils";
import { formatTime } from "@/modules/shared/duties/utils/upcomingDutyUtils";

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return da.getTime() === db.getTime();
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

interface RsSwapTargetModalProps {
  open: boolean;
  source: RSUpcomingGroup | null;
  myDuties: Duty[];
  onClose: () => void;
}

/**
 * Target picker for an RS group swap. Lists every currently-available RS group
 * (from the same Select Duty pipeline), filtering out:
 *   - the source group itself
 *   - groups where every room is already RS-assigned
 *   - groups whose time window conflicts with any of the RS's OTHER duties
 *     (duties outside the source group — moving off source would free those,
 *     so we ignore self-conflicts)
 *
 * On submit, POSTs a single rs_swap change request with the source duty IDs
 * and target examRoom IDs. Approval by CS moves the whole group atomically.
 */
export default function RsSwapTargetModal({
  open,
  source,
  myDuties,
  onClose,
}: RsSwapTargetModalProps) {
  const { groups: allGroups, isLoading } = useAvailableRsGroups();
  const createRequest = useCreateChangeRequest();

  const [selected, setSelected] = useState<RSDutyGroup | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ID set of the source group's duties — used to exclude source rooms from
  // the "other duties" list when running the time-conflict check.
  const sourceDutyIds = useMemo(() => {
    if (!source) return new Set<string>();
    return new Set(source.rooms.map((r) => r.dutyId));
  }, [source]);

  const otherDuties = useMemo(
    () => myDuties.filter((d) => !sourceDutyIds.has(d._id)),
    [myDuties, sourceDutyIds],
  );

  const eligibleTargets = useMemo(() => {
    if (!source) return [];
    return allGroups.filter((g) => {
      if (g.groupId === source.groupId) return false;
      if (g.allAssigned) return false;
      // If any target room already has a persisted RS duty (and it's not one of
      // ours in the source group), the target is not free.
      const anyOccupied = g.rooms.some((r) => r.flags.rsAssigned);
      if (anyOccupied) return false;
      // Time conflict with any OTHER duty of the requester?
      const clash = otherDuties.some((d) => {
        if (!sameDay(d.date, g.date)) return false;
        if (d.status !== "assigned") return false;
        return overlaps(d.startTime, d.endTime, g.startTime, g.endTime);
      });
      if (clash) return false;
      return true;
    });
  }, [allGroups, source, otherDuties]);

  if (!open || !source) return null;

  const handleClose = () => {
    setSelected(null);
    setReason("");
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    if (!selected) return;
    setError(null);
    createRequest.mutate(
      {
        type: "rs_swap",
        reason: reason.trim() || "No reason provided.",
        rsSourceDuties: source.rooms.map((r) => r.dutyId),
        rsTargetExamRooms: selected.rooms.map((r) => r.examRoomId),
        rsSourceKey: source.groupId,
        rsTargetKey: selected.groupId,
      },
      {
        onSuccess: handleClose,
        onError: (e) => {
          setError(e instanceof Error ? e.message : "Failed to submit request.");
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div className="relative w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold text-gray-800">
              Request RS Group Swap
            </h3>
            <p className="text-xs text-gray-500">
              Pick a vacant RS group to move your entire current group to.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {/* Source group summary */}
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Current Group
            </p>
            <SourceSummary source={source} />
          </section>

          {/* Target picker */}
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Available Target Groups
            </p>

            {isLoading && (
              <p className="py-4 text-center text-sm text-gray-400">
                Loading available groups...
              </p>
            )}

            {!isLoading && eligibleTargets.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400">
                No vacant RS groups match. Every candidate is either full or
                conflicts with your other duties.
              </p>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {eligibleTargets.map((g) => (
                <TargetTile
                  key={g.groupId}
                  group={g}
                  selected={selected?.groupId === g.groupId}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </section>

          {/* Reason */}
          <section>
            <label
              htmlFor="rs-reason"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-gray-400"
            >
              Reason (optional)
            </label>
            <textarea
              id="rs-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. clash with faculty meeting"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </section>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            onClick={handleClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selected || createRequest.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            {createRequest.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                Submit Swap Request
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceSummary({ source }: { source: RSUpcomingGroup }) {
  const typeColor = getTypeColor(source.examType);
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${typeColor}`}
        >
          {source.examType}
        </span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
          Sem {source.semester}
        </span>
      </div>
      <div className="text-xs text-gray-600">
        {formatShortDate(source.date)} · {formatTime(source.startTime)} –{" "}
        {formatTime(source.endTime)}
      </div>
      <div className="text-sm font-semibold text-gray-800">
        {source.buildingName} — {source.rangeLabel}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {source.rooms.map((r) => (
          <span
            key={r.dutyId}
            className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
          >
            {r.roomNumber}
          </span>
        ))}
      </div>
    </div>
  );
}

function TargetTile({
  group,
  selected,
  onSelect,
}: {
  group: RSDutyGroup;
  selected: boolean;
  onSelect: (g: RSDutyGroup) => void;
}) {
  const typeColor = getTypeColor(group.examType);
  return (
    <button
      onClick={() => onSelect(group)}
      className={`flex flex-col gap-2 rounded-lg border-2 p-3 text-left transition-all ${
        selected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${typeColor}`}
          >
            {group.examType}
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
            Sem {group.semester}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700">
          {selected ? "Selected" : "Available"}
        </span>
      </div>

      <div className="text-xs text-gray-600">
        {formatShortDate(group.date)} · {formatTime(group.startTime)} –{" "}
        {formatTime(group.endTime)}
      </div>
      <div className="text-sm font-semibold text-gray-800">
        {group.buildingName} — {group.rangeLabel}
      </div>
      <div className="flex flex-wrap gap-1">
        {group.rooms.map((r) => (
          <span
            key={r.examRoomId}
            className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
          >
            {r.roomNumber}
          </span>
        ))}
      </div>
    </button>
  );
}
