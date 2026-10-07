import { useCallback, useEffect, useRef, useState } from "react";
import { AlarmClock, BellRing, Check, RotateCcw } from "lucide-react";
import { useInView } from "../hooks/useReveal";

/**
 * The hero's live demo: one exam slot, ten rooms, and a few simulated teachers
 * claiming them in real time — the visitor claims one too. It acts out the real
 * product rules: one duty per time slot, "just taken" when someone wins the
 * race, holders' names hidden from other teachers, a self-claimed duty is
 * confirmed at once, and the phone sets its alarms (1 h and 20 min before).
 * Pure client-side; nothing is sent anywhere.
 */

type RoomState = "open" | "taken" | "yours" | "claiming";

interface Room {
  id: string;
  building: string;
  number: string;
  state: RoomState;
}

const SLOT = { label: "IA1 · Sem 5", day: "Tue 14 Oct", start: "09:30", end: "12:30" };
const ALARMS = [
  { at: "08:30", label: "1 hour before" },
  { at: "09:10", label: "20 min before" },
];

const INITIAL: Room[] = [
  ...["101", "102", "103", "104", "105"].map((n) => ({ id: `M${n}`, building: "Main Block", number: n, state: "open" as RoomState })),
  ...["004", "005", "006", "007", "008"].map((n) => ({ id: `A${n}`, building: "Academic Block", number: n, state: "open" as RoomState })),
].map((r) => (r.id === "M103" || r.id === "A006" ? { ...r, state: "taken" as RoomState } : r));

type Toast = { tone: "ok" | "warn" | "info"; text: string } | null;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function ClaimDemo() {
  const [rooms, setRooms] = useState<Room[]>(INITIAL);
  const [toast, setToast] = useState<Toast>(null);
  const [ringing, setRinging] = useState(false);
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The simulation reads the latest rooms without restarting its timer chain.
  const roomsRef = useRef(rooms);
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  const say = useCallback((t: Toast) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Other teachers claiming rooms while the demo is on screen. Once most rooms
  // are gone, an occasional room frees up (a swap was approved) to keep it alive.
  useEffect(() => {
    if (!inView) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = roomsRef.current;
      const open = current.filter((r) => r.state === "open");
      const taken = current.filter((r) => r.state === "taken");
      if (open.length > 3) {
        const pick = open[Math.floor(Math.random() * open.length)];
        setRooms((rs) => rs.map((r) => (r.id === pick.id && r.state === "open" ? { ...r, state: "taken" } : r)));
      } else if (taken.length > 0) {
        const pick = taken[Math.floor(Math.random() * taken.length)];
        setRooms((rs) => rs.map((r) => (r.id === pick.id ? { ...r, state: "open" } : r)));
        say({ tone: "info", text: `Room ${pick.number} just freed up — a swap was approved.` });
      }
      timer = setTimeout(tick, rand(2400, 4200));
    };
    timer = setTimeout(tick, rand(1600, 2600));
    return () => clearTimeout(timer);
  }, [inView, say]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const mine = rooms.find((r) => r.state === "yours" || r.state === "claiming");
  const counts = {
    open: rooms.filter((r) => r.state === "open").length,
    taken: rooms.filter((r) => r.state === "taken").length,
  };

  const claim = (room: Room) => {
    if (room.state === "taken") {
      say({ tone: "warn", text: "Occupied. Only the exam cell sees who holds it." });
      return;
    }
    if (room.state === "yours") {
      setRooms((rs) => rs.map((r) => (r.id === room.id ? { ...r, state: "open" } : r)));
      say({ tone: "info", text: `Released room ${room.number}. Your alarms are cleared.` });
      return;
    }
    if (mine) {
      say({ tone: "warn", text: `One duty per time slot — release room ${mine.number} first.` });
      return;
    }
    // Claim, with the real race: now and then another teacher's click lands first.
    setRooms((rs) => rs.map((r) => (r.id === room.id ? { ...r, state: "claiming" } : r)));
    const lost = Math.random() < 0.15;
    setTimeout(() => {
      setRooms((rs) =>
        rs.map((r) => (r.id === room.id && r.state === "claiming" ? { ...r, state: lost ? "taken" : "yours" } : r)),
      );
      say(
        lost
          ? { tone: "warn", text: `Just taken — someone else got room ${room.number} first. Pick another.` }
          : { tone: "ok", text: `Room ${room.number} is yours. Confirmed, and your alarms are set.` },
      );
    }, 650);
  };

  const reset = () => {
    setRooms(INITIAL);
    setRinging(false);
    say(null);
  };

  const ring = () => {
    setRinging(true);
    setTimeout(() => setRinging(false), 2600);
  };

  const held = rooms.find((r) => r.state === "yours");
  const buildings = ["Main Block", "Academic Block"];

  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-[1fr_15.5rem]">
      {/* The exam slot */}
      <div className="overflow-hidden rounded-2xl bg-[#13111f] text-slate-200 shadow-[0_30px_80px_-30px_rgba(30,20,80,0.55)] ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3 font-landing-mono text-[11px] text-slate-400">
          <span>
            {SLOT.label} · {SLOT.day} · {SLOT.start}–{SLOT.end}
          </span>
          <span className="flex items-center gap-2 text-emerald-300">
            <span className="h-2 w-2 animate-blip rounded-full bg-emerald-400" />
            live · 4 teachers choosing
          </span>
        </div>

        <div className="space-y-5 px-5 py-5">
          {buildings.map((b) => (
            <div key={b}>
              <p className="mb-2 font-landing-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">{b}</p>
              <div className="grid grid-cols-5 gap-2">
                {rooms
                  .filter((r) => r.building === b)
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => claim(r)}
                      aria-label={`${b} room ${r.number}: ${r.state === "yours" ? "your duty, tap to release" : r.state}`}
                      className={`group relative flex h-[4.25rem] flex-col items-center justify-center rounded-xl border text-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                        r.state === "open"
                          ? "border-emerald-400/30 bg-emerald-400/[0.06] hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-emerald-400/[0.12]"
                          : r.state === "taken"
                            ? "border-white/5 bg-white/[0.03] text-slate-500"
                            : r.state === "claiming"
                              ? "animate-pulse border-indigo-400/60 bg-indigo-500/20"
                              : "border-indigo-300 bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/50"
                      }`}
                    >
                      <span className="font-landing text-[15px] font-semibold tabular-nums">{r.number}</span>
                      <span
                        className={`mt-0.5 font-landing-mono text-[9.5px] uppercase tracking-wider ${
                          r.state === "open" ? "text-emerald-300/90" : r.state === "yours" ? "text-indigo-100" : "text-slate-500"
                        }`}
                      >
                        {r.state === "open" ? "open" : r.state === "taken" ? "taken" : r.state === "claiming" ? "…" : "yours"}
                      </span>
                      {r.state === "yours" ? (
                        <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-white" aria-hidden />
                      ) : null}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <p className="min-h-[1.25rem] text-[12.5px] leading-snug" aria-live="polite">
            {toast ? (
              <span
                className={
                  toast.tone === "ok" ? "text-emerald-300" : toast.tone === "warn" ? "text-amber-300" : "text-sky-300"
                }
              >
                {toast.text}
              </span>
            ) : (
              <span className="text-slate-400">
                <span className="tabular-nums text-emerald-300">{counts.open}</span> open ·{" "}
                <span className="tabular-nums">{counts.taken}</span> taken — tap an open room to take the duty.
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={reset}
            className="flex shrink-0 items-center gap-1.5 font-landing-mono text-[11px] text-slate-500 transition-colors hover:text-slate-200"
          >
            <RotateCcw className="h-3 w-3" aria-hidden /> reset
          </button>
        </div>
      </div>

      {/* The teacher's phone */}
      <div
        className={`relative mx-auto w-full max-w-[15.5rem] rounded-[2.2rem] border-[7px] border-[#1d1a2b] bg-[#1d1a2b] shadow-[0_30px_60px_-25px_rgba(30,20,80,0.6)] motion-reduce:animate-none ${
          ringing ? "animate-ring" : ""
        }`}
      >
        <div className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-[#1d1a2b]" aria-hidden />
        {ringing && held ? (
          <div className="flex min-h-[19rem] lg:min-h-[23rem] flex-col justify-between rounded-[1.7rem] bg-gradient-to-b from-indigo-600 to-violet-700 px-4 pb-5 pt-9 text-white">
            <div className="text-center">
              <BellRing className="mx-auto h-7 w-7" aria-hidden />
              <p className="mt-2 font-landing text-4xl font-semibold tabular-nums">09:10</p>
              <p className="mt-1 text-sm text-indigo-100">Exam duty in 20 minutes</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 text-[12px] leading-relaxed">
              <p className="font-landing-mono text-[10px] uppercase tracking-wider text-indigo-200">Invigilator · {SLOT.label}</p>
              <p className="font-semibold">
                {held.building} — {held.number}
              </p>
              <p className="text-indigo-100">
                {SLOT.start} – {SLOT.end}
              </p>
            </div>
            <div className="space-y-2">
              <span className="block rounded-full bg-emerald-400 py-2 text-center text-[13px] font-semibold text-emerald-950">
                I&apos;m on my way
              </span>
              <span className="block rounded-full bg-white/15 py-2 text-center text-[13px]">Snooze 5 min</span>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[19rem] lg:min-h-[23rem] flex-col rounded-[1.7rem] bg-[#f7f5f0] px-4 pb-4 pt-9 text-[#17151f]">
            <p className="font-landing-mono text-[10px] uppercase tracking-[0.18em] text-[#8a8494]">Proctavo · upcoming</p>
            {held ? (
              <>
                <div className="mt-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                  <p className="font-landing-mono text-[10px] uppercase tracking-wider text-indigo-600">
                    Invigilator · {SLOT.label}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold">
                    {held.building} — {held.number}
                  </p>
                  <p className="text-[12.5px] text-[#625d6e]">
                    {SLOT.day} · {SLOT.start} – {SLOT.end}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <Check className="h-3 w-3" aria-hidden /> Confirmed
                  </p>
                </div>
                <p className="mt-4 font-landing-mono text-[10px] uppercase tracking-[0.18em] text-[#8a8494]">Alarms set</p>
                <ul className="mt-2 space-y-1.5">
                  {ALARMS.map((a) => (
                    <li key={a.at} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[12.5px] ring-1 ring-black/5">
                      <AlarmClock className="h-3.5 w-3.5 text-indigo-600" aria-hidden />
                      <span className="font-semibold tabular-nums">{a.at}</span>
                      <span className="text-[#625d6e]">{a.label}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={ring}
                  className="mt-auto flex items-center justify-center gap-1.5 rounded-full bg-[#17151f] py-2 text-[12.5px] font-semibold text-white transition-transform hover:scale-[1.02]"
                >
                  <BellRing className="h-3.5 w-3.5" aria-hidden /> Ring the 20-min alarm
                </button>
              </>
            ) : (
              <div className="my-auto text-center">
                <AlarmClock className="mx-auto h-8 w-8 text-[#c9c3d6]" aria-hidden />
                <p className="mt-3 text-[13px] font-medium">No duty yet</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#8a8494]">Take an open room — the duty and its alarms appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
