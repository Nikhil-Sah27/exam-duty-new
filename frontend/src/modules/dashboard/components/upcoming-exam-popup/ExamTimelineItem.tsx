import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";
import {
  formatExamRange,
  formatSemDepartments,
  getExamAccent,
  NEAREST_ACCENT,
} from "../../utils/examPopupUtils";
import ExamCountdown from "./ExamCountdown";

interface ExamTimelineItemProps {
  exam: ExamGroup;
  /** When false, a connector line is drawn down to the next item. */
  isLast: boolean;
  /** The single nearest upcoming exam — highlighted in orange. */
  isNearest?: boolean;
}

/** One row of the upcoming-exams timeline: dot + details + countdown pill. */
export default function ExamTimelineItem({
  exam,
  isLast,
  isNearest = false,
}: ExamTimelineItemProps) {
  const accent = isNearest ? NEAREST_ACCENT : getExamAccent(exam.examType);
  return (
    <li className="flex gap-3">
      {/* Marker column: dot + vertical connector */}
      <div className="flex flex-col items-center">
        <span
          className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white/40 dark:ring-white/10 ${accent.dot}`}
        />
        {!isLast && (
          <span className="w-px flex-1 bg-slate-200/70 dark:bg-slate-600/50" />
        )}
      </div>

      {/* Details — the nearest exam gets a soft orange highlight box */}
      <div
        className={`flex flex-1 items-start justify-between gap-3 ${
          isNearest
            ? "-mx-2 mb-5 rounded-xl bg-orange-50/70 px-2.5 pb-3 pt-2 ring-1 ring-orange-200/70 dark:bg-orange-500/10 dark:ring-orange-400/25"
            : "pb-5"
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">
            {exam.examType}{" "}
            <span className={accent.pillText}>
              — {formatSemDepartments(exam.semester, exam.departments)}
            </span>
          </p>
          <p className="mt-1 truncate">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
              {formatExamRange(exam.startDate, exam.endDate)}
            </span>
          </p>
        </div>
        <ExamCountdown
          startDate={exam.startDate}
          examType={exam.examType}
          accent={isNearest ? accent : undefined}
        />
      </div>
    </li>
  );
}
