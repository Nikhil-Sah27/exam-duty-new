import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/** Closing call-to-action band. */
export default function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-14 text-center shadow-2xl shadow-indigo-900/40">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-2xl"
        />
        <h2 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to streamline exam duties?
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-indigo-100">
          Sign in to your Proctavo account and take control of invigilation
          planning today.
        </p>
        <Link
          to="/login"
          className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-lg transition-transform hover:scale-105"
        >
          Sign in
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
