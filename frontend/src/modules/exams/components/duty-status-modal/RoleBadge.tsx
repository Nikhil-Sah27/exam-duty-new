import { CheckCircle2, AlertCircle, ChevronRight, UserMinus } from "lucide-react";
import ContactActions from "@/shared/components/ContactActions";

export default function RoleBadge({
  label,
  assigned,
  assignee,
  onAssignClick,
  onUnassignClick,
  awaitingConfirmation,
}: {
  label: string;
  assigned: boolean;
  assignee?: { name: string; email: string; department?: string | null; designation?: string | null; phone?: string | null } | null;
  /** When provided and the slot is vacant, the whole row becomes a button
   *  that opens the CS assignment flow for this role. */
  onAssignClick?: () => void;
  /** When provided and the slot is filled, shows a CS Unassign action. */
  onUnassignClick?: () => void;
  /** Filled, but the holder hasn't confirmed yet (CS view). */
  awaitingConfirmation?: boolean;
}) {
  const clickable = !assigned && !!onAssignClick;
  const Wrapper = clickable ? "button" : "div";

  return (
    <Wrapper
      {...(clickable ? { onClick: onAssignClick, type: "button" as const } : {})}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
        clickable
          ? "border-red-200 bg-red-50 hover:border-blue-300 hover:bg-blue-50"
          : "border-gray-100 bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {assigned && awaitingConfirmation ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            <CheckCircle2 className="h-3 w-3" /> Awaiting confirmation
          </span>
        ) : assigned ? (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
            <CheckCircle2 className="h-3 w-3" /> Assigned
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
            <AlertCircle className="h-3 w-3" /> Vacant
            {clickable && <ChevronRight className="h-3 w-3" />}
          </span>
        )}
      </div>
      {clickable && (
        <p className="mt-1 text-[11px] font-medium text-blue-600">
          Click to assign
        </p>
      )}
      {assigned && assignee && (
        <div className="mt-1.5 text-[11px] leading-snug text-gray-500">
          <p className="font-medium text-gray-700">{assignee.name}</p>
          {(assignee.designation || assignee.department) && (
            <p>
              {assignee.designation}
              {assignee.designation && assignee.department ? " · " : ""}
              {assignee.department}
            </p>
          )}
          <p className="mt-0.5">{assignee.email}</p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <ContactActions phone={assignee.phone} />
            {onUnassignClick && (
              <button
                type="button"
                onClick={onUnassignClick}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <UserMinus className="h-3 w-3" /> Unassign
              </button>
            )}
          </div>
        </div>
      )}
    </Wrapper>
  );
}
