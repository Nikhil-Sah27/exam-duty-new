import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight } from "lucide-react";
import ClaimDemo from "./ClaimDemo";

/**
 * Landing hero — an editorial headline, then the product itself: a live exam
 * slot the visitor can take a duty in (ClaimDemo).
 */
export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft brand glow behind the demo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-40 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.18),transparent_65%)]"
      />
      <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 lg:pt-20">
        <p className="font-landing-mono text-[11px] font-medium uppercase tracking-[0.22em] text-indigo-600">
          Exam-duty planner for exam cells, controllers &amp; faculty
        </p>
        <h1 className="mt-5 max-w-5xl font-editorial text-[3.4rem] leading-[0.98] tracking-[-0.01em] text-[#17151f] sm:text-7xl lg:text-[6.6rem]">
          Every exam room,{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text italic text-transparent">covered</span>.
        </h1>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,19rem)_1fr] lg:gap-14">
          <div className="lg:pt-2">
            <p className="font-landing text-[17px] leading-relaxed text-[#4a4556]">
              Proctavo turns your timetable, rooms and faculty into a fair invigilation roster. The exam cell assigns in a
              click, teachers pick or swap their own duties — and every one of them is reminded, confirmed and, on the
              day, <span className="text-[#17151f]">woken up by an alarm</span>.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#17151f] px-6 py-3 font-landing text-[15px] font-medium text-white shadow-lg shadow-black/10 transition-transform hover:scale-[1.03]"
              >
                Sign in <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-1.5 border-b border-[#17151f]/40 pb-0.5 font-landing text-[15px] text-[#17151f] transition-colors hover:border-[#17151f]"
              >
                How it works <ArrowDown className="h-4 w-4" aria-hidden />
              </a>
            </div>
            <p className="mt-10 hidden font-editorial text-xl italic leading-snug text-[#625d6e] lg:block">
              “Go on — take a room. Four other teachers are after the same slot.”
            </p>
          </div>

          <div id="demo" className="scroll-mt-24">
            <ClaimDemo />
            <p className="mt-3 font-landing text-[13px] leading-relaxed text-[#8a8494]">
              A real slot, simulated: rooms fill up live, one duty per teacher per slot, and if two people tap the same room
              only one gets it. Tap your room again to give it back.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
