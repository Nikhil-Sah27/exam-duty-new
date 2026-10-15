import { AlarmClock, BellRing, CalendarCheck2, CheckCircle2, MailCheck, Footprints } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Eyebrow from "./Eyebrow";
import Reveal from "./Reveal";

const TIMELINE: { when: string; title: string; body: string; icon: LucideIcon }[] = [
  { when: "Assigned", title: "Email + calendar invite", body: "The duty lands in their calendar — and moves or cancels itself if the duty does.", icon: CalendarCheck2 },
  { when: "+24 h", title: "Nudge to confirm", body: "Not confirmed yet? One click in the email tells the exam cell they’ll be there.", icon: MailCheck },
  { when: "−3 d · −1 d · −30 min", title: "Reminders", body: "Dated reminders — never a vague “tomorrow” — once per duty, even for a five-room group.", icon: CheckCircle2 },
  { when: "−1 h · −20 min", title: "The phone rings", body: "With the Proctavo app: a real alarm, full-screen, with “I’m on my way” — nobody sleeps through a 9:30 paper.", icon: AlarmClock },
  { when: "Exam day", title: "Everyone’s where they should be", body: "Still unconfirmed the day before? The exam cell is told first, with time to act.", icon: Footprints },
];

/** Dark band: what happens after the roster is made. */
export default function ReminderBand() {
  return (
    <section className="relative overflow-hidden bg-[#0e0c19] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.28),transparent_65%)]"
      />
      <div className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-28">
        <Reveal>
          <Eyebrow tone="dark">After the roster</Eyebrow>
          <h2 className="mt-4 max-w-4xl font-editorial text-5xl leading-[1.02] sm:text-6xl">
            A spreadsheet says who’s free. Proctavo makes sure they{" "}
            <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text italic text-transparent">show up</span>.
          </h2>
        </Reveal>

        <ol className="mt-16 grid gap-4 md:grid-cols-5">
          {TIMELINE.map((t, i) => (
            <Reveal key={t.when} delay={i * 90}>
              <li className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-indigo-400/40 hover:bg-white/[0.05]">
                <div className="flex items-center justify-between">
                  <span className="font-landing-mono text-[11px] uppercase tracking-wider text-indigo-300">{t.when}</span>
                  <t.icon className="h-4 w-4 text-slate-500" aria-hidden />
                </div>
                <h3 className="mt-5 font-landing text-[16px] font-semibold leading-snug">{t.title}</h3>
                <p className="mt-2 font-landing text-[13.5px] leading-relaxed text-slate-400">{t.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={200}>
          <p className="mt-10 flex items-center gap-2 font-landing text-[14px] text-slate-400">
            <BellRing className="h-4 w-4 text-indigo-300" aria-hidden />
            Nothing is ever released automatically — unconfirmed duties are flagged to the exam cell, not dropped.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
