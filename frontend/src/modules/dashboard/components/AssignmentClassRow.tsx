import type { ClassAssignmentRow } from "@/modules/shared/exams/selectors/dashboardSelectors";
import {
  examLabel,
  roomLabel,
  sessionLabel,
  formatTimeRange,
} from "../utils/assignmentFormat";
import DutyAssignmentSummary from "./DutyAssignmentSummary";
import AssignmentStatusBadge from "./AssignmentStatusBadge";
import AssignDutyButton from "./AssignDutyButton";

/**
 * One classroom row in the teacher-assignment drill-down table. Purely
 * presentational — assignment happens through the Assign button, which the
 * parent view wires to the existing duty-assignment modal.
 */
export default function AssignmentClassRow({
  row,
  onAssign,
}: {
  row: ClassAssignmentRow;
  onAssign: (slotId: string) => void;
}) {
  const { room, building } = roomLabel(row);

  return (
    <tr className="border-t border-gray-100 align-middle transition-colors hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-800">{room}</p>
        <p className="text-xs text-slate-400">{building}</p>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{examLabel(row)}</td>
      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
        <span className="font-medium text-slate-700">
          {sessionLabel(row.startTime)}
        </span>{" "}
        · {formatTimeRange(row.startTime, row.endTime)}
      </td>
      <td className="px-4 py-3">
        <DutyAssignmentSummary flags={row.flags} />
      </td>
      <td className="px-4 py-3">
        <AssignmentStatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <AssignDutyButton onClick={() => onAssign(row.slotId)} />
      </td>
    </tr>
  );
}
