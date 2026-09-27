import { UserPlus } from "lucide-react";

/**
 * The single "Assign" action per classroom. Opens the existing duty-assignment
 * modal for that room (DCS / RS / Invigilator) — no separate per-role buttons.
 */
export default function AssignDutyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500"
    >
      <UserPlus className="h-3.5 w-3.5" />
      Assign
    </button>
  );
}
