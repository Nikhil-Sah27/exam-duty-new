import { ArrowLeftRight, Boxes, CalendarDays, MessagesSquare, Radio, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Eyebrow from "./Eyebrow";
import Reveal from "./Reveal";

const FEATURES: { icon: LucideIcon; title: string; tag: string; body: string; points: string[] }[] = [
  {
    icon: Scale,
    title: "Fair, computed targets",
    tag: "workload",
    body: "Targets come from real inputs — course load, student counts, room capacity — split across designations.",
    points: ["Recomputed on demand, never stale", "Target reached? No more CS assignments"],
  },
  {
    icon: Boxes,
    title: "Room groups for RS & DCS",
    tag: "groups",
    body: "Room Superintendents cover up to five rooms per building and slot; DCS cover blocks sized by student count.",
    points: ["A whole group claimed in one step", "Counted as one duty, reminded once"],
  },
  {
    icon: ArrowLeftRight,
    title: "Change requests & swaps",
    tag: "requests",
    body: "Teachers ask to move, drop or swap; the exam cell approves in one click and the same duty updates everywhere.",
    points: ["No double-booking, ever", "The new holder is told instantly"],
  },
  {
    icon: CalendarDays,
    title: "Calendar invites that keep up",
    tag: "calendar",
    body: "Every duty arrives as a proper invite in Google Calendar, Outlook or Apple — and updates or cancels itself.",
    points: ["One event per duty or group", "No calendar access needed"],
  },
  {
    icon: Radio,
    title: "Live, on every screen",
    tag: "realtime",
    body: "When a room is claimed, every open page shows it within seconds — no refreshing to find out it’s gone.",
    points: ["Race-proof claims", "Live counts while you choose"],
  },
  {
    icon: MessagesSquare,
    title: "Talk to the exam cell",
    tag: "messages",
    body: "Teachers message the exam cell directly — questions, problems, swaps — with replies in the same thread.",
    points: ["One thread per teacher", "The exam cell sees an inbox"],
  },
];

/** Capability cards. */
export default function FeatureSection() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <Reveal>
          <Eyebrow>What’s inside</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-editorial text-5xl leading-[1.02] text-[#17151f] sm:text-6xl">
            Built around how exam duty <span className="italic text-indigo-600">really</span> runs.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 90}>
              <article className="flex h-full flex-col rounded-2xl border border-[#e6e1d6] bg-[#fbfaf7] p-6 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_18px_40px_-24px_rgba(60,40,140,0.35)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                    <f.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-landing-mono text-[10.5px] uppercase tracking-[0.18em] text-indigo-500">{f.tag}</span>
                </div>
                <h3 className="mt-5 font-landing text-[17px] font-semibold text-[#17151f]">{f.title}</h3>
                <p className="mt-2 font-landing text-[14.5px] leading-relaxed text-[#5a5466]">{f.body}</p>
                <ul className="mt-auto space-y-1.5 border-t border-[#ebe6dc] pt-4 font-landing text-[13px] text-[#4a4556]">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-indigo-500" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
