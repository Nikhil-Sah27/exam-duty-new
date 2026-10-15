import type { ReactNode } from "react";

/** Small uppercase mono label above section headings: "• HOW IT WORKS". */
export default function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <p
      className={`flex items-center gap-2 font-landing-mono text-[11px] font-medium uppercase tracking-[0.22em] ${
        tone === "dark" ? "text-indigo-300" : "text-indigo-600"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "dark" ? "bg-indigo-400" : "bg-indigo-500"}`} />
      {children}
    </p>
  );
}
