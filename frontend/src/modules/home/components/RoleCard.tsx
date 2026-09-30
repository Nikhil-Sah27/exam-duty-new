import type { LucideIcon } from "lucide-react";

export interface RoleInfo {
  icon: LucideIcon;
  name: string;
  full: string;
  description: string;
  /** Tailwind gradient classes for the accent bar + icon. */
  accent: string;
}

/** A role highlight card with a colored top accent (matches the app's role tints). */
export default function RoleCard({ icon: Icon, name, full, description, accent }: RoleInfo) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition-all hover:-translate-y-1 hover:bg-white/[0.07]">
      <div className={`h-1.5 w-full bg-gradient-to-r ${accent}`} />
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-lg`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-white">{name}</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {full}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}
