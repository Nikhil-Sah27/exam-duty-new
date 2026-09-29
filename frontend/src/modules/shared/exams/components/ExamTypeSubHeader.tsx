import type { ExamGroupType } from "../types/exam.types";
import { getTypeColor, getTypeSubtitle } from "../utils/examStatusUtils";

/**
 * Sub-heading for an exam type inside a status band (SEE / IA1 / IA2 / IA3).
 * Shows the colour-coded type chip, its full-name subtitle, and a count, with a
 * divider line to separate it from the cards below.
 */
export default function ExamTypeSubHeader({
  type,
  count,
}: {
  type: ExamGroupType;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${getTypeColor(
          type,
        )}`}
      >
        {type}
      </span>
      <span className="text-xs text-gray-400">
        · {getTypeSubtitle(type)} ({count})
      </span>
      <div className="ml-1 h-px flex-1 bg-gray-100" />
    </div>
  );
}
