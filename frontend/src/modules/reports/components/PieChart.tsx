export interface PieSlice {
  label: string;
  value: number;
  /** CSS color (hex/rgb) — used for both the wedge and the legend dot. */
  color: string;
}

interface PieChartProps {
  title: string;
  slices: PieSlice[];
  /** Diameter in px. */
  size?: number;
}

const pct = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

/**
 * A donut chart driven by a CSS conic-gradient (no chart library, no SVG arc
 * maths) with a legend that shows each slice's value and percentage. Purely
 * presentational — the caller supplies the slices and colors.
 */
export default function PieChart({ title, slices, size = 150 }: PieChartProps) {
  const total = slices.reduce((s, x) => s + x.value, 0);

  // Build cumulative conic-gradient stops. With no data we render a flat gray
  // ring so the card still has shape.
  let acc = 0;
  const stops =
    total > 0
      ? slices
          .map((s) => {
            const start = acc;
            acc += (s.value / total) * 100;
            return `${s.color} ${start}% ${acc}%`;
          })
          .join(", ")
      : "#e5e7eb 0% 100%";

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="self-start text-sm font-semibold text-gray-700">{title}</h3>

      <div className="flex items-center gap-5">
        <div
          className="relative shrink-0 rounded-full"
          style={{
            width: size,
            height: size,
            background: `conic-gradient(${stops})`,
          }}
          role="img"
          aria-label={title}
        >
          {/* Donut hole — bg-white is re-themed to the card surface in dark mode. */}
          <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-xl font-extrabold text-gray-800">
              {total}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              total
            </span>
          </div>
        </div>

        <ul className="space-y-1.5">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-gray-600">{s.label}</span>
              <span className="ml-auto font-semibold text-gray-800">
                {pct(s.value, total)}%
              </span>
              <span className="text-gray-400">({s.value})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
