import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/shared/components";

const LINKS = [
  { href: "#demo", label: "Try it" },
  { href: "#how", label: "How it works" },
  { href: "#roles", label: "Roles" },
  { href: "#alarms", label: "Phone alarms" },
];

/** Sticky top bar for the public landing page — brand, section links, sign-in. */
export default function HomeNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e6e1d6]/80 bg-[#f5f2ec]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo size={30} showWordmark wordmarkClassName="font-landing text-lg font-semibold tracking-tight text-[#17151f]" />

        <nav className="hidden items-center gap-7 font-landing text-[14px] text-[#4a4556] md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-[#17151f]">
              {l.label}
            </a>
          ))}
        </nav>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-full bg-[#17151f] px-4 py-2 font-landing text-[14px] font-medium text-white transition-transform hover:scale-[1.03]"
        >
          Sign in <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
