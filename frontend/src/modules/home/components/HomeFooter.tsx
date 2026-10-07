import { Link } from "react-router-dom";
import { Logo } from "@/shared/components";

/** Minimal landing footer. */
export default function HomeFooter() {
  return (
    <footer className="border-t border-[#e6e1d6]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 py-10 sm:flex-row sm:px-8">
        <Logo size={26} showWordmark wordmarkClassName="font-landing text-[15px] font-semibold text-[#17151f]" />
        <nav className="flex flex-wrap items-center justify-center gap-6 font-landing text-[13.5px] text-[#625d6e]">
          <a href="#how" className="hover:text-[#17151f]">How it works</a>
          <a href="#roles" className="hover:text-[#17151f]">Roles</a>
          <a href="#alarms" className="hover:text-[#17151f]">Phone alarms</a>
          <Link to="/login" className="hover:text-[#17151f]">Sign in</Link>
        </nav>
        <p className="font-landing-mono text-[11px] text-[#8a8494]">© {new Date().getFullYear()} Proctavo</p>
      </div>
    </footer>
  );
}
