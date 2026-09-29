import type { ExamGroup, ExamGroupStatus } from "@/modules/exams/types";
import {
  getStatusStyle,
  getTypeColor,
} from "@/modules/shared/exams/utils/examStatusUtils";
import { formatDate } from "@/shared/lib/utils";
import { DEPARTMENT_CHIP_CLASS } from "../utils/rosterFormat";
import { STATUS_LABEL } from "../utils/sortExamsForPicker";

interface ExamOptionContentProps {
  exam: ExamGroup;
  /** When provided, renders the exam's status pill (ongoing/upcoming/completed)
   *  inline instead of relying on grouped section headers. */
  status?: ExamGroupStatus;
}

/**
 * The visual body of an exam entry, shared by the picker trigger and each
 * option row so the selected exam reads identically to how it looked in the
 * list. Highlights the exam type (IA1/IA2/IA3/SEE each get their own colour),
 * the semester, an inline status pill, and every department involved as a
 * uniform neutral chip.
 */
export default function ExamOptionContent({
  exam,
  status,
}: ExamOptionContentProps) {
  const departments = exam.departments ?? [];
  const statusStyle = status ? getStatusStyle(status) : null;

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {status && statusStyle && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusStyle.bg} ${statusStyle.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
            {STATUS_LABEL[status]}
          </span>
        )}
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${getTypeColor(
            exam.examType,
          )}`}
        >
          {exam.examType}
        </span>
        <span className="inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
          Sem {exam.semester}
        </span>
        <span className="text-[11px] text-gray-500">
          {formatDate(exam.startDate)} – {formatDate(exam.endDate)}
        </span>
      </div>

      {departments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {departments.map((d) => (
            <span key={d} className={DEPARTMENT_CHIP_CLASS}>
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
