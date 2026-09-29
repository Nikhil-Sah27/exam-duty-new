import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /**
   * Tailwind classes for the icon bubble, e.g. "bg-amber-100 text-amber-600".
   * Colored tints keep their hue in dark mode; the card surface adapts.
   */
  accent?: string;
  /** Optional call-to-action rendered under the text (e.g. a button). */
  action?: ReactNode;
}

/**
 * A polished, reusable empty-state block: a soft card with a colored icon bubble,
 * a title, and supporting copy. Replaces bare dashed placeholders so "nothing
 * here" still looks intentional and on-brand across the app.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  accent = "bg-indigo-100 text-indigo-600",
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-2xl ring-8 ring-gray-50 ${accent}`}
      >
        <Icon className="h-8 w-8" />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-gray-800">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-gray-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
