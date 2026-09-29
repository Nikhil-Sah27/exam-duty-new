import type { RoleEngagement } from "@/modules/duty-calculation/utils/roleEngagement";
import { ROLE_LABEL } from "@/modules/duty-calculation/utils/roleEngagement";

interface RoleCompletionBarsProps {
  roles: RoleEngagement[];
}

// Per-role bar color, matching the dashboard donut accents (invigilator indigo,
// RS emerald, DCS amber).
const ROLE_COLOR: Record<string, string> = {
  invigilator: "#6366f1",
  rs: "#10b981",
  dcs: "#f59e0b",
  cs: "#64748b",
};

/**
 * Horizontal bar chart of duty-completion percentage per role — the same
 * completed/target figures the dashboard shows as donuts, laid out as bars so
 * the roles compare at a glance.
 */
export default function RoleCompletionBars({ roles }: RoleCompletionBarsProps) {
  if (roles.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
        No duty targets to report yet.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {roles.map((r) => {
        const clamped = Math.max(0, Math.min(100, r.percentage));
        const color = ROLE_COLOR[r.role] ?? ROLE_COLOR.cs;
        return (
          <div key={r.role} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">
                {ROLE_LABEL[r.role]}
              </span>
              <span className="text-gray-500">
                {r.completed} / {r.target} duties ·{" "}
                <span className="font-semibold text-gray-800">{clamped}%</span>
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${clamped}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
