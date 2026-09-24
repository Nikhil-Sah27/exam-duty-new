import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardHeroProps {
  title: string;
  subtitle: string;
  badge: string;
  gradient: string; // tailwind from-/via-/to- triple
  stats?: { label: string; value: number | string }[];
  /**
   * Custom content for the top-right slot. When set, it replaces `stats` —
   * useful when a role needs richer widgets (e.g. progress circles) rather
   * than the default label/value tiles.
   */
  rightContent?: ReactNode;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}

/**
 * Hero banner reused by every operational dashboard. Each role passes its
 * gradient + stat tiles so the band reads as "this is YOUR dashboard" while
 * the layout stays consistent.
 */
export default function DashboardHero({
  title,
  subtitle,
  badge,
  gradient,
  stats,
  rightContent,
  primaryAction,
  secondaryAction,
}: DashboardHeroProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r p-5 text-white shadow-lg ${gradient}`}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-black/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
            <Sparkles className="h-2.5 w-2.5" />
            {badge}
          </span>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-white/85">{subtitle}</p>

          {(primaryAction || secondaryAction) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {primaryAction && (
                <Link
                  to={primaryAction.href}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-sm transition-colors hover:bg-white/90"
                >
                  {primaryAction.label}
                </Link>
              )}
              {secondaryAction && (
                <Link
                  to={secondaryAction.href}
                  className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/30 backdrop-blur-sm transition-colors hover:bg-white/25"
                >
                  {secondaryAction.label}
                </Link>
              )}
            </div>
          )}
        </div>

        {rightContent ? (
          <div className="w-full sm:w-auto">{rightContent}</div>
        ) : (
          stats && stats.length > 0 && (
            <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm ring-1 ring-white/20"
                >
                  <p className="text-xl font-bold leading-tight">{s.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/80">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
