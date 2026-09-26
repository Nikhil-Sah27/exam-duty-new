import { useState, type KeyboardEvent } from "react";
import type { ExamGroup } from "@/modules/shared/exams/types/exam.types";
import UpcomingExamTimeline from "./UpcomingExamTimeline";
import UpcomingExamCalendar from "./UpcomingExamCalendar";

interface UpcomingExamFlipCardProps {
  exams: ExamGroup[];
}

/**
 * Two-sided flip card (timeline ⇄ calendar). Clicking anywhere on the card
 * toggles a smooth 3D rotateY flip. The 3D bits use inline styles (perspective,
 * preserve-3d, backface-visibility) so behaviour doesn't depend on a specific
 * Tailwind 3D-utility version.
 */
export default function UpcomingExamFlipCard({ exams }: UpcomingExamFlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((f) => !f);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={
        flipped
          ? "Show upcoming exams timeline"
          : "Show upcoming exam dates calendar"
      }
      onClick={toggle}
      onKeyDown={onKeyDown}
      className="h-[360px] w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 rounded-2xl"
      style={{ perspective: "1400px" }}
    >
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front — timeline */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <UpcomingExamTimeline exams={exams} />
        </div>

        {/* Back — calendar (pre-rotated so it reads correctly once flipped) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <UpcomingExamCalendar exams={exams} />
        </div>
      </div>
    </div>
  );
}
