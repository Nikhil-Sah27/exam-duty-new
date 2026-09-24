import { ReactNode } from "react";
import type { ExamGroup, ExamGroupStatus } from "../types/exam.types";
import { useGroupedExams } from "../hooks/useGroupedExams";
import { getExamGroupStatus, getTypeSubtitle } from "../utils/examStatusUtils";
import ExamCard from "./ExamCard";
import ExamStatusSection from "./ExamStatusSection";
import ExamTypeHeader from "./ExamTypeHeader";

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
  /** Optional section subtitle overrides. */
  cieTitle?: string;
  cieSubtitle?: string;
  seeTitle?: string;
  seeSubtitle?: string;
  /** Hide section headers entirely (compact embed in a dashboard). */
  compact?: boolean;
}

const DEFAULT_EMPTY = (
  <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
    <p className="text-sm text-gray-500">No exams match the current filters.</p>
  </div>
);

/**
 * One-stop component for the CIE/SEE/IA1-3 + Ongoing/Upcoming/Completed
 * grouped exam listing. Use this everywhere exams are listed so every
 * dashboard stays visually and structurally identical to the CS view.
 *
 * The card renderer defaults to the shared <ExamCard>, which auto-styles
 * SEE differently from CIE. Pages with bespoke needs (e.g. inline "Your
 * duty here" badge) can override via `renderCard`.
 */
export default function ExamGroupSection({
  exams,
  selectedType = "",
  selectedSemester = "",
  getCardHref,
  onDelete,
  renderCard,
  emptyState,
  cieTitle = "CIE — Internal Exams",
  cieSubtitle = "Continuous Internal Evaluation · IA1, IA2, IA3",
  seeTitle = "SEE — Semester End Exams",
  seeSubtitle = "External Examination",
  compact = false,
}: ExamGroupSectionProps) {
  const {
    categorized,
    cieBuckets,
    seeBuckets,
    showCIE,
    showSEE,
    statusOrder,
    total,
  } = useGroupedExams(exams, { selectedType, selectedSemester });

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

  const cieCount =
    categorized.cie.IA1.length +
    categorized.cie.IA2.length +
    categorized.cie.IA3.length;
  const seeCount = categorized.see.length;

  // When a filter pins us to one IA type, hide the sibling IA blocks so the
  // page doesn't render empty bands.
  const ia: ("IA1" | "IA2" | "IA3")[] =
    selectedType === "IA1" || selectedType === "IA2" || selectedType === "IA3"
      ? [selectedType]
      : ["IA1", "IA2", "IA3"];

  return (
    <div className="space-y-10">
      {showCIE && cieCount > 0 && (
        <section className="space-y-5">
          {!compact && (
            <ExamTypeHeader
              variant="cie"
              title={cieTitle}
              subtitle={cieSubtitle}
              count={cieCount}
            />
          )}

          <div className="space-y-8">
            {ia.map((subType) => {
              const list = categorized.cie[subType];
              if (list.length === 0) return null;
              const buckets = cieBuckets[subType];
              return (
                <div key={subType} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tracking-wide text-gray-700">
                      {subType}
                    </span>
                    <span className="text-xs text-gray-400">
                      · {getTypeSubtitle(subType)} ({list.length})
                    </span>
                    <div className="ml-1 h-px flex-1 bg-gray-100" />
                  </div>
                  {statusOrder.map((status) => (
                    <ExamStatusSection
                      key={status}
                      status={status}
                      exams={buckets[status]}
                      renderCard={(g) => cardFor(g, getExamGroupStatus(g))}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showSEE && seeCount > 0 && (
        <section className="space-y-5">
          {!compact && (
            <ExamTypeHeader
              variant="see"
              title={seeTitle}
              subtitle={seeSubtitle}
              count={seeCount}
            />
          )}

          <div className="space-y-6">
            {statusOrder.map((status) => (
              <ExamStatusSection
                key={status}
                status={status}
                exams={seeBuckets[status]}
                renderCard={(g) => cardFor(g, getExamGroupStatus(g))}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
