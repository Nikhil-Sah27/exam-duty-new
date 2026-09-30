import { useEffect, useState } from "react";
import Modal from "@/shared/components/Modal";
import { useUnassignDuty } from "../hooks";

export interface UnassignTarget {
  /** Any duty in the slot. For a group, the backend expands it to the whole group. */
  dutyId: string;
  /** RS / DCS — unassigned as one unit, never room by room. */
  group: boolean;
  teacherName: string;
  /** What is being taken away, e.g. "RS group of 5 rooms on 12 Oct". */
  what: string;
}

interface UnassignDutyModalProps {
  target: UnassignTarget | null;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * CS confirmation for taking a teacher off a duty. The reason is optional and,
 * when given, is shown to the teacher in the notification and email.
 */
export default function UnassignDutyModal({ target, onClose, onDone }: UnassignDutyModalProps) {
  const [reason, setReason] = useState("");
  const unassign = useUnassignDuty();

  // Fresh form each time the modal opens for a new target.
  useEffect(() => {
    setReason("");
    unassign.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.dutyId]);

  if (!target) return null;

  const submit = () => {
    unassign.mutate(
      { dutyId: target.dutyId, group: target.group, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          onClose();
          onDone?.();
        },
      },
    );
  };

  return (
    <Modal open onClose={unassign.isPending ? () => {} : onClose} title="Unassign duty?">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">{target.teacherName}</span> will be removed
          from the {target.what}. The slot becomes vacant and they'll be notified.
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            Reason <span className="font-normal text-gray-400">(optional — shown to the teacher)</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="e.g. Reassigning to cover another exam"
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        {unassign.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {unassign.error.message}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={unassign.isPending}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={unassign.isPending}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {unassign.isPending ? "Unassigning..." : "Unassign"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
