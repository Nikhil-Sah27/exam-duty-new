/**
 * A stylised, static mock of the actual Proctavo UI — the landing "demo".
 * Rendered with plain divs (no screenshots) so it stays crisp and self-hosted:
 * a duty-progress ring, a room-status grid, and the assign panel with the same
 * "N left" badge the real app uses.
 */
export default function AppPreview() {
  // Room grid: true = assigned (green), false = still open (red).
  const rooms = [
    { n: "004", ok: true },
    { n: "005", ok: true },
    { n: "006", ok: false },
    { n: "007", ok: true },
    { n: "008", ok: false },
    { n: "101", ok: true },
    { n: "102", ok: true },
    { n: "103", ok: true },
    { n: "201", ok: false },
    { n: "202", ok: true },
  ];

  const pct = 68;
  const r = 26;
  const circ = 2 * Math.PI * r;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/40 backdrop-blur">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-slate-800/80 px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 flex-1 truncate rounded-md bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-400">
          proctavo.com/dashboard
        </span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-5">
        {/* Progress ring */}
        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4 sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            IA1 · Sem 5 · Duty coverage
          </p>
          <div className="mt-3 flex items-center gap-4">
            <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
              <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
              <circle
                cx="36"
                cy="36"
                r={r}
                fill="none"
                stroke="url(#g)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${(circ * pct) / 100} ${circ}`}
                transform="rotate(-90 36 36)"
              />
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#818cf8" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <text x="36" y="40" textAnchor="middle" className="fill-white text-[14px] font-bold">
                {pct}%
              </text>
            </svg>
            <div className="text-sm">
              <p className="font-bold text-white">41 / 60</p>
              <p className="text-[11px] text-slate-400">rooms assigned</p>
              <p className="mt-1 text-[11px] text-rose-300">19 still open</p>
            </div>
          </div>
        </div>

        {/* Room grid */}
        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4 sm:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Academic Block — rooms
          </p>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {rooms.map((room) => (
              <div
                key={room.n}
                className={`flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium ${
                  room.ok
                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                    : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${room.ok ? "bg-emerald-400" : "bg-rose-400"}`} />
                {room.n}
              </div>
            ))}
          </div>
        </div>

        {/* Assign panel snippet */}
        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4 sm:col-span-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Assign invigilator · Room 006
          </p>
          <div className="mt-3 space-y-2">
            {[
              { name: "Aarti Rao", meta: "Assistant Professor · CSE", left: 3 },
              { name: "Vikram Nair", meta: "Associate Professor · ISE", left: 1 },
            ].map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{t.name}</p>
                    <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                      {t.left} left
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-400">{t.meta}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-indigo-500 px-3 py-1 text-[11px] font-semibold text-white">
                  Assign
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
