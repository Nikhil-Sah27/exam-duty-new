import type { DutyStatus } from "@/modules/shared/exams/types/exam.types";
import { getStatusLabel } from "@/modules/shared/exams/utils/dutyStatusUtils";

const STYLES: Record<DutyStatus, string> = {
  NOT_ASSIGNED: "bg-red-100 text-red-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  FULLY_ASSIGNED: "bg-green-100 text-green-700",
};

const DOT: Record<DutyStatus, string> = {
  NOT_ASSIGNED: "bg-red-500",
  PARTIAL: "bg-amber-500",
  FULLY_ASSIGNED: "bg-green-500",
};

/**
 * Small status pill for a classroom's overall duty status. Reuses the shared
 * `getStatusLabel` so wording stays consistent with the rest of the app.
 */
export default function AssignmentStatusBadge({
  status,
}: {
  status: DutyStatus;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {getStatusLabel(status)}
    </span>
  );
}
