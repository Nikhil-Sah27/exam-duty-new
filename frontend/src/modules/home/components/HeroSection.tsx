import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";

/** Landing hero — headline, subtext, and primary CTAs. */
export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient gradient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-20 h-[26rem] w-[26rem] rounded-full bg-violet-600/20 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-20 text-center sm:px-8 sm:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-indigo-200 backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5" />
          Role-based exam invigilation planner
        </span>

        <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl">
          Exam invigilation,
          <span className="block bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            perfectly orchestrated.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Proctavo helps the Controller of Superintendents assign, track and
          balance invigilation duties across rooms, groups and roles — with live
          change requests, in-app messaging and smart reminders.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-indigo-500/30 transition-transform hover:scale-105 sm:w-auto"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10 sm:w-auto"
          >
            Explore features
          </a>
        </div>
      </div>
    </section>
  );
}
