import { X, Star } from "lucide-react";
import type {
  ImportantNotification,
  NotificationAccent,
} from "./types";

const ACCENT: Record<
  NotificationAccent,
  { dot: string; label: string; bar: string; action: string }
> = {
  red: {
    dot: "bg-red-500",
    label: "text-red-600 dark:text-red-300",
    bar: "bg-red-500",
    action: "text-red-600 dark:text-red-300",
  },
  amber: {
    dot: "bg-amber-500",
    label: "text-amber-600 dark:text-amber-300",
    bar: "bg-amber-500",
    action: "text-amber-600 dark:text-amber-300",
  },
  blue: {
    dot: "bg-blue-500",
    label: "text-blue-600 dark:text-blue-300",
    bar: "bg-blue-500",
    action: "text-blue-600 dark:text-blue-300",
  },
  violet: {
    dot: "bg-violet-500",
    label: "text-violet-600 dark:text-violet-300",
    bar: "bg-violet-500",
    action: "text-violet-600 dark:text-violet-300",
  },
  green: {
    dot: "bg-emerald-500",
    label: "text-emerald-600 dark:text-emerald-300",
    bar: "bg-emerald-500",
    action: "text-emerald-600 dark:text-emerald-300",
  },
};

interface ImportantNotificationPopupProps {
  notification: ImportantNotification;
  visible: boolean;
  onAction: () => void;
  onClose: () => void;
}

/**
 * A single liquid-glass notification bubble. Same glassmorphism language as the
 * Upcoming Exams Timeline popup (translucent bg, backdrop blur, rainbow edge,
 * sheen), with a subtle per-type accent bar + category badge and a lower-left
 * tail for the message-bubble feel. Slides in from the left via inline
 * transform/opacity transitions driven by `visible`.
 */
export default function ImportantNotificationPopup({
  notification,
  visible,
  onAction,
  onClose,
}: ImportantNotificationPopupProps) {
  const a = ACCENT[notification.accent];
  const clickable = Boolean(notification.actionHref);
  const highlighted = Boolean(notification.highlight);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto relative w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white/90 p-4 pl-5 backdrop-blur-2xl backdrop-saturate-150 dark:bg-slate-900/90 ${
        highlighted
          ? "shadow-[0_18px_55px_-10px_rgba(245,158,11,0.6)]"
          : "shadow-[0_18px_50px_-12px_rgba(99,102,241,0.45)]"
      }`}
      style={{
        // Slow, gentle fade in/out with a subtle slide — "fading" = appears and
        // disappears slowly.
        transition:
          "opacity 0.9s ease, transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-24px)",
      }}
    >
      {/* "Very important" gold pulsing ring — sits above the rainbow edge. */}
      {highlighted && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-amber-400/80 animate-pulse"
        />
      )}
      {/* Colorful liquid-glass edge (rainbow ring painted on the border only). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          padding: "1.4px",
          background:
            "conic-gradient(from 130deg at 50% 50%, #f9a8d4, #fca5a5, #fdba74, #fde68a, #86efac, #5eead4, #93c5fd, #c4b5fd, #f9a8d4)",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      {/* Glossy sheen + inner hairline highlight. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/60 via-white/10 to-transparent dark:from-white/10 dark:via-white/[0.03]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/40 dark:ring-white/10"
      />
      {/* Per-type accent bar down the left edge. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-3 left-1.5 w-1 rounded-full ${a.bar}`}
      />

      {/* Close — sibling of the action area, so it never triggers navigation. */}
      <button
        type="button"
        aria-label="Close notification"
        onClick={onClose}
        className="absolute right-2.5 top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/60 text-slate-500 ring-1 ring-white/60 backdrop-blur transition hover:bg-white hover:text-slate-800 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Content — the whole area is the action target when clickable. */}
      <button
        type="button"
        onClick={clickable ? onAction : undefined}
        className={`relative z-10 block w-full pr-6 text-left ${
          clickable ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <span className="flex items-center gap-1.5">
          {highlighted ? (
            <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
          ) : (
            <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
          )}
          <span
            className={`text-[10px] font-bold uppercase tracking-widest ${
              highlighted ? "text-amber-600 dark:text-amber-300" : a.label
            }`}
          >
            {notification.category}
          </span>
        </span>
        <p className="mt-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-300">
          {notification.message}
        </p>
        {clickable && notification.actionLabel && (
          <span
            className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${a.action}`}
          >
            {notification.actionLabel} <span aria-hidden>→</span>
          </span>
        )}
      </button>
    </div>
  );
}
