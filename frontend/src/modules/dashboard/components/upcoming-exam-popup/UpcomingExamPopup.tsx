import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useAuthStore } from "@/shared/store/auth.store";
import { useUpcomingExamPopup } from "../../hooks/useUpcomingExamPopup";
import { useDraggable } from "./useDraggable";
import UpcomingExamFlipCard from "./UpcomingExamFlipCard";

/**
 * Floating glassmorphism notification card shown at the bottom of the CS
 * Dashboard whenever a CS user opens or refreshes the page and there are
 * upcoming exams. Purely additive — rendered via a portal so it floats above
 * the dashboard without altering any existing layout.
 *
 * Front: Upcoming Exams Timeline. Back: Upcoming Exam Dates calendar. Clicking
 * the card flips between them; the × button closes it (and never flips).
 */
export default function UpcomingExamPopup() {
  const user = useAuthStore((s) => s.user);
  const { exams, hasExams } = useUpcomingExamPopup();
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  // Drag-to-reposition. Starts null → the card keeps its default bottom-center
  // spot until the CS drags the grip handle, then floats at fixed coordinates.
  const { ref, position, isDragging, dragHandleProps, suppressClickAfterDrag } =
    useDraggable<HTMLDivElement>();

  // Slide-up entrance on first paint.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const isCs = user?.activeRole === "cs";
  if (!isCs || !hasExams || !open) return null;

  const close = (e: MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
  };

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-4 sm:px-4 sm:pb-6">
      <div
        ref={ref}
        role="dialog"
        aria-label="Upcoming exams"
        onPointerDown={dragHandleProps.onPointerDown}
        onPointerMove={dragHandleProps.onPointerMove}
        onPointerUp={dragHandleProps.onPointerUp}
        className="pointer-events-auto relative w-full max-w-[560px] cursor-grab touch-none overflow-hidden rounded-[24px] bg-white/45 p-4 shadow-[0_18px_60px_-12px_rgba(99,102,241,0.45)] backdrop-blur-2xl backdrop-saturate-150 active:cursor-grabbing dark:bg-slate-900/60 sm:p-5"
        style={{
          transition: isDragging
            ? "none"
            : "opacity 0.45s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          ...(position
            ? {
                position: "fixed" as const,
                left: position.x,
                top: position.y,
                margin: 0,
              }
            : {}),
        }}
      >
        {/* Colorful liquid-glass border — a rainbow gradient ring painted only
            on the 1.6px edge via mask compositing, so the glass center stays
            clean. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[24px]"
          style={{
            padding: "1.6px",
            background:
              "conic-gradient(from 130deg at 50% 50%, #f9a8d4, #fca5a5, #fdba74, #fde68a, #86efac, #5eead4, #93c5fd, #c4b5fd, #f9a8d4)",
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Glossy top-left sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-br from-white/60 via-white/10 to-transparent dark:from-white/10 dark:via-white/[0.03]"
        />
        {/* Subtle liquid color wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-tr from-sky-200/30 via-transparent to-fuchsia-200/30"
        />
        {/* Inner hairline highlight for extra depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-inset ring-white/40"
        />

        {/* Close button — sibling of the card. Its own pointerdown stops
            propagation so it never starts a card drag, and it never flips. */}
        <button
          type="button"
          aria-label="Close upcoming exams"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={close}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-slate-500 ring-1 ring-white/60 backdrop-blur transition hover:bg-white hover:text-slate-800 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative z-10" onClickCapture={suppressClickAfterDrag}>
          <UpcomingExamFlipCard exams={exams} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
