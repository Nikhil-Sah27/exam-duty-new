import type { LucideIcon } from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** A single glass feature tile for the landing page. */
export default function FeatureCard({ icon: Icon, title, description }: Feature) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-all hover:-translate-y-1 hover:border-indigo-400/40 hover:bg-white/[0.07]">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 transition-transform group-hover:scale-110">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
        {description}
      </p>
    </div>
  );
}
