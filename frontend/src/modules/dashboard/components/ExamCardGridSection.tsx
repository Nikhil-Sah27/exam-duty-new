import type { ReactNode } from "react";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";
import DashboardExamCard from "./DashboardExamCard";

interface ExamCardGridSectionProps {
  title: string;
  icon: ReactNode;
  /** Colour classes for the count badge (e.g. "bg-emerald-100 text-emerald-700"). */
  countBadge: string;
  exams: ExamGroup[];
  emptyText: string;
  /** Optional anchor id so summary cards can scroll here. */
  id?: string;
}

/**
 * Shared presentational shell for the Ongoing / Upcoming exam sections: a
 * titled header with a live count badge and a responsive grid of the shared
 * exam cards. Both OngoingExamsSection and UpcomingExamsSection wrap this so
 * there's no duplicated layout/logic.
 */
export default function ExamCardGridSection({
  title,
  icon,
  countBadge,
  exams,
  emptyText,
  id,
}: ExamCardGridSectionProps) {
  return (
    <section id={id} className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-slate-700">{icon}</span>
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${countBadge}`}
        >
          {exams.length}
        </span>
      </div>

      {exams.length === 0 ? (
        <p className="py-8 text-center text-[15px] font-medium italic tracking-wide text-slate-400">
          {emptyText}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {exams.map((g) => (
            <DashboardExamCard key={g._id} group={g} />
          ))}
        </div>
      )}
    </section>
  );
}
