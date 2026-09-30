import { Logo } from "@/shared/components";

/** Minimal landing-page footer. */
export default function HomeFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-slate-950/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-slate-400 sm:flex-row sm:px-8">
        <Logo
          size={28}
          showWordmark
          className="text-white"
          wordmarkClassName="font-semibold text-white"
        />
        <p>© {year} Proctavo · Exam Duty Management</p>
      </div>
    </footer>
  );
}
