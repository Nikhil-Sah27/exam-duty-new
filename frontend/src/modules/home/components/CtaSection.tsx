import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal";

/** Closing call to action. */
export default function CtaSection() {
  return (
    <section className="px-5 pb-24 sm:px-8">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#0e0c19] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 left-1/2 h-[30rem] w-[50rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(124,58,237,0.35),transparent_65%)]"
          />
          <h2 className="relative mx-auto max-w-3xl font-editorial text-5xl leading-[1.02] sm:text-6xl">
            Run your next exam cycle <span className="italic text-indigo-300">on Proctavo</span>.
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl font-landing text-[16px] leading-relaxed text-slate-400">
            Your exam cell signs in with the accounts it already has. Teachers get their duties, reminders and calendar
            invites from day one.
          </p>
          <Link
            to="/login"
            className="relative mt-9 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-landing text-[15px] font-semibold text-[#17151f] transition-transform hover:scale-[1.03]"
          >
            Sign in to Proctavo <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
