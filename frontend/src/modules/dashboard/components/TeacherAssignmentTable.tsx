import type { ClassAssignmentRow } from "@/modules/shared/exams/selectors/dashboardSelectors";
import AssignmentClassRow from "./AssignmentClassRow";

/**
 * The class-level assignment table. Compact, scrollable on narrow screens.
 * Renders one <AssignmentClassRow> per classroom and delegates the Assign
 * action upward via `onAssign`.
 */
export default function TeacherAssignmentTable({
  classes,
  onAssign,
}: {
  classes: ClassAssignmentRow[];
  onAssign: (slotId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-left">
        <thead>
          <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Room</th>
            <th className="px-4 py-3">Exam</th>
            <th className="px-4 py-3">Session</th>
            <th className="px-4 py-3">Duties</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((row) => (
            <AssignmentClassRow
              key={row.slotId}
              row={row}
              onAssign={onAssign}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
