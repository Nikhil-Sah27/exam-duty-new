import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AppPreview from "./AppPreview";

/** Landing hero — split layout: what-we-do copy on the left, live app mock right. */
export default function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      {/* Real campus backdrop, dimmed — grounds the page in an actual institution. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center opacity-[0.12]"
        style={{ backgroundImage: "url(/campus-bg.jpg)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/85 to-slate-950"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
            Built for exam cells &amp; controllers
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Exam invigilation duty,
            <br />
            without the spreadsheets.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
            Proctavo turns your exam timetable, rooms and faculty into a fair
            invigilation roster. The Controller assigns duties in a click,
            teachers pick up or swap their own, and everyone gets calendar
            invites and reminders automatically.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-400"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5"
            >
              See how it works
            </a>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            Roles for CS · DCS · RS · Invigilator — each sees only what they need.
          </p>
        </div>

        <div className="lg:pl-4">
          <AppPreview />
        </div>
      </div>
    </section>
  );
}
