import { BellRing, Check, VolumeX } from "lucide-react";
import Eyebrow from "./Eyebrow";
import Reveal from "./Reveal";

const POINTS = [
  { icon: BellRing, text: "Rings 1 hour and 20 minutes before every duty — each teacher picks their own times." },
  { icon: VolumeX, text: "Loud and full-screen, even on silent — on Android, and on iPhone with iOS 26 or later." },
  { icon: Check, text: "“I’m on my way” confirms the duty; a cancelled duty’s alarm removes itself." },
];

/** The phone app: duty alarms. */
export default function PhoneSection() {
  return (
    <section id="alarms" className="scroll-mt-20 overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_auto]">
        <Reveal>
          <Eyebrow>The Proctavo app · rolling out</Eyebrow>
          <h2 className="mt-4 max-w-xl font-editorial text-5xl leading-[1.02] text-[#17151f] sm:text-6xl">
            Not another notification. <span className="italic text-indigo-600">An alarm.</span>
          </h2>
          <p className="mt-5 max-w-lg font-landing text-[16px] leading-relaxed text-[#5a5466]">
            Invigilators, RS and DCS get their duties, alerts and Select Duty on their phone — and the phone wakes them for
            the exam the way an alarm clock would.
          </p>
          <ul className="mt-8 max-w-lg space-y-4">
            {POINTS.map((p) => (
              <li key={p.text} className="flex gap-3 font-landing text-[15px] leading-relaxed text-[#2b2734]">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <p.icon className="h-4 w-4" aria-hidden />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={150} className="mx-auto">
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-16 bg-[radial-gradient(closest-side,rgba(124,58,237,0.24),transparent)]"
            />
            <div className="relative w-[17rem] rounded-[2.6rem] border-[9px] border-[#1d1a2b] bg-[#1d1a2b] shadow-[0_40px_80px_-30px_rgba(30,20,80,0.6)]">
              <div className="absolute left-1/2 top-2.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[#1d1a2b]" aria-hidden />
              <div className="flex h-[33rem] flex-col justify-between rounded-[2rem] bg-gradient-to-b from-indigo-600 via-indigo-700 to-violet-800 px-5 pb-6 pt-12 text-white">
                <div className="text-center">
                  <BellRing className="mx-auto h-8 w-8 animate-ring motion-reduce:animate-none" aria-hidden />
                  <p className="mt-3 font-landing text-6xl font-semibold tabular-nums tracking-tight">9:10</p>
                  <p className="mt-2 font-landing text-[15px] text-indigo-100">Exam duty in 20 minutes</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-4 font-landing text-[13px] leading-relaxed ring-1 ring-white/15">
                  <p className="font-landing-mono text-[10px] uppercase tracking-wider text-indigo-200">RS · SEE · Sem 3</p>
                  <p className="mt-1 text-[16px] font-semibold">Main Block — 201, 202, 203</p>
                  <p className="text-indigo-100">9:30 AM – 12:30 PM · Tue 14 Oct</p>
                  <p className="mt-2 text-amber-200">Not confirmed yet — “I’m on my way” confirms it.</p>
                </div>
                <div className="space-y-2.5 font-landing text-[14px]">
                  <span className="block rounded-full bg-emerald-400 py-2.5 text-center font-semibold text-emerald-950">
                    I&apos;m on my way
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <span className="rounded-full bg-white/15 py-2.5 text-center">Snooze 5 min</span>
                    <span className="rounded-full bg-white/15 py-2.5 text-center">Dismiss</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
