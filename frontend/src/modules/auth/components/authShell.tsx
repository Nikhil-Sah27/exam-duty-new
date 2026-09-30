import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

/** Dark frosted input — deep translucent fill with light text, on the glass card. */
export const GLASS_INPUT =
  "w-full rounded-xl border border-white/15 bg-slate-950/50 py-3 text-sm text-white shadow-inner backdrop-blur-sm transition-colors placeholder:text-white/40 focus:border-blue-400/70 focus:bg-slate-950/60 focus:outline-none focus:ring-2 focus:ring-blue-400/40";

/**
 * The Proctavo logo — the brand asset with its white background removed and the
 * dark lettering reversed to white, so it sits directly on the dark auth surface
 * (no plate) while keeping the blue→violet "avo" gradient. `className` sets the
 * logo height.
 */
export function ProctavoBrand({
  center = false,
  className = "h-10",
}: {
  /** Accepted for call-site compatibility; the image renders the same either way. */
  onDark?: boolean;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={center ? "flex justify-center" : ""}>
      <img
        src="/proctavo-wordmark.png"
        alt="Proctavo — Exam Duty Management System"
        className={`w-auto ${className}`}
      />
    </div>
  );
}

/**
 * The macOS-style liquid-glass card: gradient translucent body, saturated
 * backdrop blur, a bright specular top rim (masked gradient border), a soft
 * top-left sheen, and a deep outer shadow. Shared by the sign-in and
 * password-reset views so they read as one surface.
 */
export function GlassCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-white/20 to-white/5 p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(255,255,255,0.08),0_28px_90px_-20px_rgba(2,6,23,0.8)] backdrop-blur-2xl backdrop-saturate-[200%] sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[28px]"
        style={{
          padding: "1px",
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.7), rgba(255,255,255,0.08) 38%, rgba(255,255,255,0.18))",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 -top-1/3 h-2/3 w-3/4 rounded-full bg-white/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-sky-300/15 blur-2xl"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Labeled input with a leading icon — matches the password field styling. */
export function Field({
  label,
  id,
  icon: Icon,
  className = "pl-10 pr-3",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  icon: ComponentType<LucideProps>;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-white/80"
      >
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
        <input id={id} className={`${GLASS_INPUT} ${className}`} {...props} />
      </div>
    </div>
  );
}
