import type { AssigneePublic } from "@/modules/exams/types";

/**
 * One role cell in the roster table: the assigned teacher's name + contact, or
 * a "Vacant" pill when the slot is open.
 */
export default function AssigneeCell({
  assignee,
}: {
  assignee: AssigneePublic | null;
}) {
  if (!assignee) {
    return (
      <td className="px-4 py-2">
        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
          Vacant
        </span>
      </td>
    );
  }
  return (
    <td className="px-4 py-2">
      <div className="font-semibold text-emerald-600 dark:text-emerald-400">
        {assignee.name}
      </div>
      <div className="text-[11px] text-gray-400">
        {assignee.phone || assignee.email}
      </div>
    </td>
  );
}
