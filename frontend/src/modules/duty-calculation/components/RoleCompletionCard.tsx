import { ROLE_LABEL, type RoleEngagement } from "../utils/roleEngagement";

/** Ring colour per role (readable on light and dark surfaces). */
const ROLE_COLOR: Record<string, string> = {
  invigilator: "#6366f1", // indigo
  rs: "#10b981", // emerald
  dcs: "#f59e0b", // amber
  cs: "#64748b", // slate
};

const SIZE = 76;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A single role's overall duty-completion as a progress donut: the filled arc is
 * the aggregate completion percentage (completed ÷ target across every teacher
 * in that role), with the exact percentage in the centre and completed/target
 * beneath. Purely presentational — the caller supplies one aggregated
 * `RoleEngagement`.
 */
export default function RoleCompletionCard({ item }: { item: RoleEngagement }) {
  const pct = Math.max(0, Math.min(100, item.percentage));
  const color = ROLE_COLOR[item.role] ?? ROLE_COLOR.cs;
  const filled = (pct / 100) * CIRCUMFERENCE;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
          role="img"
          aria-label={`${ROLE_LABEL[item.role]} duty completion ${pct}%`}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#94a3b8"
            strokeOpacity={0.25}
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-base font-extrabold text-gray-800">
          {pct}%
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {ROLE_LABEL[item.role]}
        </div>
        <div className="mt-0.5 text-sm font-semibold text-gray-800">
          Duty completed
        </div>
        <div className="text-[11px] text-gray-400">
          {item.completed} / {item.target} duties
        </div>
      </div>
    </div>
  );
}
