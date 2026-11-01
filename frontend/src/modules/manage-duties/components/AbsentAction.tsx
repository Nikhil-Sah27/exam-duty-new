import { Undo2, UserX } from "lucide-react";

/** What a duty card or row needs to offer CS the no-show action (ADS_PLAN.md §1b). */
export interface AbsenceControls {
  /** Whether the unit holding this duty is marked absent. */
  isAbsent: (dutyId: string) => boolean;
  /** Ask to mark absent (confirmed first) or undo (immediate). `what` names the duty for the dialog. */
  toggle: (dutyId: string, absent: boolean, what: string) => void;
  /** The duty whose change is in flight, so its button can wait. */
  pendingDutyId: string | null;
}

interface AbsentActionProps {
  controls: AbsenceControls;
  dutyId: string | undefined;
  what: string;
}

/** Small CS action under a past duty: record a no-show, or take it back. */
export default function AbsentAction({ controls, dutyId, what }: AbsentActionProps) {
  if (!dutyId) return null;
  const absent = controls.isAbsent(dutyId);
  const pending = controls.pendingDutyId === dutyId;
  return (
    <div className="flex items-center justify-end gap-2">
      {absent && (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
          Absent
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => controls.toggle(dutyId, !absent, what)}
        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
          absent ? "border-gray-200 text-gray-600 hover:bg-gray-50" : "border-amber-200 text-amber-700 hover:bg-amber-50"
        }`}
      >
        {absent ? <Undo2 className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
        {absent ? "Undo absent" : "Mark absent"}
      </button>
    </div>
  );
}
