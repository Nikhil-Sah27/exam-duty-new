interface DashboardHeroProps {
  /** Display name of the signed-in user (falls back to a generic greeting). */
  name?: string;
}

/** "Friday" — full weekday name. */
function formatDay(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "long" });
}

/** "25 Sep 2026" — day, short month, full year. */
function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Welcome banner at the top of the CS dashboard. The panel is highlighted on
 * the left and fades to transparent on the right (no hard "box" edge). The
 * greeting and the logo/date block are flex siblings with a gap, so they can
 * never overlap — the greeting wraps for long names while the crest/date stay
 * put. The BMSIT&M campus sits behind the crest as a faint watermark.
 */
export default function DashboardHero({ name }: DashboardHeroProps) {
  const today = new Date();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-100 via-indigo-100 to-transparent">
      {/* Campus building watermark — faded, behind the crest on the right. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] bg-cover bg-center opacity-25 sm:block"
        style={{
          backgroundImage: "url('/campus-bg.jpg')",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 55%)",
          maskImage: "linear-gradient(to right, transparent, black 55%)",
        }}
        aria-hidden
      />

      {/* Content row: greeting (grows / wraps) + crest & date (fixed). The gap
          and shrink-0 guarantee the two blocks never overlap. */}
      <div className="relative z-10 flex min-h-[150px] items-center justify-between gap-8 px-6 py-6 sm:px-10">
        <h1 className="min-w-0 text-2xl font-bold leading-tight text-slate-800 sm:text-[28px]">
          Welcome back
          {name && (
            <>
              ,{" "}
              {/* Font-only accent: same colour / weight / size, italic Poppins. */}
              <span className="font-display italic">{name}</span>
            </>
          )}{" "}
          <span className="animate-wave inline-block origin-[70%_70%]" aria-hidden>
            👋
          </span>
        </h1>

        <div className="hidden shrink-0 items-center gap-4 sm:flex">
          <img
            src="/bmsit-logo.png"
            alt="BMS Institute of Technology & Management crest"
            className="pointer-events-none h-[118px] w-[118px] select-none object-contain drop-shadow-md"
            draggable={false}
          />
          <div className="text-right">
            <p className="text-3xl font-extrabold leading-none text-slate-500/60 [text-shadow:0_1px_3px_rgba(255,255,255,0.7)]">
              {formatDay(today)}
            </p>
            <p className="mt-1.5 text-base font-bold text-slate-500/60 [text-shadow:0_1px_3px_rgba(255,255,255,0.7)]">
              {formatDate(today)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
