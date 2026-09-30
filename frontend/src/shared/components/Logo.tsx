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

/**
 * The Proctavo brand mark — a gradient squircle "P" — matching /favicon.svg.
 * Rendered inline as SVG so it scales crisply and the gradient id is unique per
 * instance (avoids clashes when several logos render on one page).
 */
export default function Logo({
  size = 32,
  showWordmark = false,
  className = "",
  wordmarkClassName = "text-lg font-bold tracking-tight",
}: LogoProps) {
  // Unique gradient id per size so multiple logos on a page don't collide.
  const gid = `proctavo-grad-${size}`;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label="Proctavo"
        className="shrink-0"
      >
        <defs>
          <linearGradient
            id={gid}
            x1="0"
            y1="0"
            x2="64"
            y2="64"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="17" fill={`url(#${gid})`} />
        <path
          d="M26 19 H34 A9 9 0 0 1 34 37 H26"
          fill="none"
          stroke="#ffffff"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="22" y="16" width="8" height="34" rx="4" fill="#ffffff" />
      </svg>
      {showWordmark && <span className={wordmarkClassName}>Proctavo</span>}
    </span>
  );
}
