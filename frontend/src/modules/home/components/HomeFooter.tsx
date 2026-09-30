/** Minimal landing-page footer. */
export default function HomeFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-slate-950/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-slate-400 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black text-white">
            P
          </span>
          <span className="font-semibold text-white">Proctavo</span>
        </div>
        <p>© {year} Proctavo · Exam Duty Management</p>
      </div>
    </footer>
  );
}
