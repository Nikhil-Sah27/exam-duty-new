import { ReactNode } from "react";
import type { ExamGroup, ExamGroupStatus } from "../types/exam.types";
import { useGroupedExams } from "../hooks/useGroupedExams";
import ExamCard from "./ExamCard";
import ExamStatusHeader from "./ExamStatusHeader";
import ExamTypeSubHeader from "./ExamTypeSubHeader";

interface ExamGroupSectionProps {
  /** Flat list of exam groups (already fetched by the parent). */
  exams: ExamGroup[];
  /** Optional type filter: "" / undefined = all, otherwise IA1|IA2|IA3|SEE. */
  selectedType?: string;
  /** Optional semester filter ("" / undefined = all). */
  selectedSemester?: string | number;
  /**
   * Where each card should link. Defaults to the exam id (relative) so the
   * same component works under `/exams`, `/invigilator/exams`, `/rs/exams`
   * etc. without each caller knowing its own base path.
   */
  getCardHref?: (group: ExamGroup) => string;
  /** Admin-only delete handler. Omit to hide the card-level delete button. */
  onDelete?: (group: ExamGroup) => void;
  /** Override the entire card (advanced — defaults to <ExamCard />). */
  renderCard?: (group: ExamGroup, status: ExamGroupStatus) => ReactNode;
  /** Shown when no exams pass the filter (or there are none at all). */
  emptyState?: ReactNode;
  /** Hide the status/type headers entirely (compact embed in a dashboard). */
  compact?: boolean;
}

const DEFAULT_EMPTY = (
  <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
    <p className="text-sm text-gray-500">No exams match the current filters.</p>
  </div>
);

/**
 * One-stop grouped exam listing. Organises exams **Status → Type**: Ongoing →
 * Upcoming → Completed at the top level, and within each status SEE → IA1 → IA2
 * → IA3. Used everywhere exams are listed so every dashboard stays visually and
 * structurally identical to the CS view.
 *
 * The card renderer defaults to the shared <ExamCard>, which auto-styles SEE
 * differently from CIE. Pages with bespoke needs (e.g. inline "Your duty here"
 * badge) can override via `renderCard`.
 */
export default function ExamGroupSection({
  exams,
  selectedType = "",
  selectedSemester = "",
  getCardHref,
  onDelete,
  renderCard,
  emptyState,
  compact = false,
}: ExamGroupSectionProps) {
  const { statusGroups, total } = useGroupedExams(exams, {
    selectedType,
    selectedSemester,
  });

  if (total === 0) {
    return <>{emptyState ?? DEFAULT_EMPTY}</>;
  }

  const defaultRender = (g: ExamGroup, status: ExamGroupStatus) => (
    <ExamCard
      key={g._id}
      group={g}
      status={status}
      to={getCardHref}
      onDelete={onDelete}
      departments={g.departments}
    />
  );
  const cardFor = renderCard ?? defaultRender;

  return (
    <div className="space-y-10">
      {statusGroups.map((sg) => (
        <section key={sg.status} className="space-y-5">
          {!compact && <ExamStatusHeader status={sg.status} count={sg.total} />}

          <div className="space-y-8">
            {sg.types.map((tg) => (
              <div key={tg.type} className="space-y-4">
                {!compact && (
                  <ExamTypeSubHeader type={tg.type} count={tg.exams.length} />
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {tg.exams.map((g) => cardFor(g, sg.status))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
