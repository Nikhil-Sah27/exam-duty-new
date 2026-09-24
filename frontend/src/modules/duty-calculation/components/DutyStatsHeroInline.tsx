import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { CheckCircle2, ClipboardList, Hourglass, Info, Loader2 } from "lucide-react";
import { useMyDutyProgress } from "../hooks/useDutyProgress";

/**
 * Inline duty-status widget designed to live inside `DashboardHero`'s
 * right slot. Uses translucent glass styling (bg-white/15 + backdrop-blur)
 * so it reads well over the hero's dark gradient regardless of role tone.
 *
 * Three circles, order requested by product: Completed → Remaining → Assigned.
 * Fed by `useMyDutyProgress`, which auto-invalidates on every mutation that
 * changes the target formula inputs (teachers, departments, semesters,
 * courses, rooms, duties).
 */
export default function DutyStatsHeroInline() {
  const { data, isLoading, error } = useMyDutyProgress();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs text-white/85 ring-1 ring-white/20 backdrop-blur-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading duty stats...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl bg-white/10 px-4 py-3 text-xs text-white/90 ring-1 ring-white/20 backdrop-blur-sm">
        Couldn't load your duty status.
      </div>
    );
  }

  if (!data.eligible) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs text-white/85 ring-1 ring-white/20 backdrop-blur-sm">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Duty target not applicable — only Assistant / Associate Professors
          carry invigilation duties.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-4">
      <HeroStatCircle
        tone="completed"
        label="Completed"
        value={data.completed}
        icon={CheckCircle2}
      />
      <HeroStatCircle
        tone="remaining"
        label="Remaining"
        value={data.remaining}
        icon={Hourglass}
      />
      <HeroStatCircle
        tone="assigned"
        label="Assigned"
        value={data.target}
        icon={ClipboardList}
      />
    </div>
  );
}

type HeroTone = "completed" | "remaining" | "assigned";

const TONE_TEXT: Record<HeroTone, string> = {
  completed: "text-emerald-100",
  remaining: "text-amber-100",
  assigned: "text-white",
};

const TONE_ICON_BG: Record<HeroTone, string> = {
  completed: "bg-emerald-400/90 text-white",
  remaining: "bg-amber-400/90 text-white",
  assigned: "bg-white text-indigo-700",
};

function HeroStatCircle({
  tone,
  label,
  value,
  icon: Icon,
}: {
  tone: HeroTone;
  label: string;
  value: number;
  icon: ComponentType<LucideProps>;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-2 ring-white/40 shadow-lg shadow-black/20">
        <div
          className={`pointer-events-none absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full shadow ring-2 ring-white/60 ${TONE_ICON_BG[tone]}`}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-2xl font-extrabold text-white drop-shadow">
          {value}
        </span>
      </div>
      <span
        className={`text-[10px] font-bold uppercase tracking-widest ${TONE_TEXT[tone]}`}
      >
        {label}
      </span>
    </div>
  );
}
