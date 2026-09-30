import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Logo } from "@/shared/components";

/** Sticky top bar for the public landing page — brand + sign-in CTA. */
export default function HomeNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo
          size={34}
          showWordmark
          className="text-white"
          wordmarkClassName="text-lg font-bold tracking-tight text-white"
        />

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#roles" className="transition-colors hover:text-white">
            Roles
          </a>
        </nav>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-105"
        >
          <LogIn className="h-4 w-4" />
          Sign in
        </Link>
      </div>
    </header>
  );
}
