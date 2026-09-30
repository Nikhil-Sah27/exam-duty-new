import { UserMinus } from "lucide-react";

/** Small CS action under a duty-group card. Kept outside the card so it never
 *  triggers the card's own open-details click. */
export default function UnassignLink({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
      >
        <UserMinus className="h-3.5 w-3.5" /> Unassign
      </button>
    </div>
  );
}
