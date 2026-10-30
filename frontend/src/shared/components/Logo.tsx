interface LogoProps {
  /** Pixel size of the square mark. */
  size?: number;
  /** Show the "Proctavo" wordmark next to the mark. */
  showWordmark?: boolean;
  /** Extra classes on the wrapper (e.g. text color for the wordmark). */
  className?: string;
  /** Classes for the wordmark text (size/weight/color). */
  wordmarkClassName?: string;
}

// The "rooms covered" mark: nine exam rooms, the last one ticked. Same small-size
// geometry as /favicon.svg. Both come from brand/generate_icons.py, so change
// them there and copy the numbers here.
const INK = "#1b1a22";
const PAPER = "#f3efe6";
const AMBER = "#f2b33d";
const ROOM_AT = [11.52, 26.31, 41.1];
const ROOM_SIDE = 11.38;
const ROOM_RADIUS = 2.88;
const TICK_POINTS = "44.14,47.17 46.03,49.07 49.52,44.89";

/** The Proctavo brand mark, inline SVG so it stays crisp at any size. */
export default function Logo({
  size = 32,
  showWordmark = false,
  className = "",
  wordmarkClassName = "text-lg font-bold tracking-tight",
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Proctavo" className="shrink-0">
        <rect width="64" height="64" rx="14.4" fill={INK} />
        {ROOM_AT.map((y, row) =>
          ROOM_AT.map((x, col) => (
            <rect
              key={`${row}-${col}`}
              x={x}
              y={y}
              width={ROOM_SIDE}
              height={ROOM_SIDE}
              rx={ROOM_RADIUS}
              fill={row === 2 && col === 2 ? AMBER : PAPER}
            />
          )),
        )}
        <polyline
          points={TICK_POINTS}
          fill="none"
          stroke={INK}
          strokeWidth="2.28"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && <span className={wordmarkClassName}>Proctavo</span>}
    </span>
  );
}
