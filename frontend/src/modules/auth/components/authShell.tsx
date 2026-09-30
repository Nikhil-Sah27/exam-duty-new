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
    <div
      className="relative overflow-hidden rounded-[32px] bg-white/10 p-8 backdrop-blur-2xl backdrop-saturate-[180%] sm:p-10"
      style={{
        // Glass depth: soft outer drop shadow + a bright inner top rim and a
        // faint inner bottom rim so the panel reads as a thick, lit slab.
        boxShadow:
          "0 24px 70px -18px rgba(2,6,23,0.75), inset 0 1.5px 1px rgba(255,255,255,0.65), inset 0 -12px 24px -18px rgba(255,255,255,0.25), inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      {/* Specular edge — a bright refractive rim, strongest at the top-left,
          painted only on the 1.2px border via mask compositing. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[32px]"
        style={{
          padding: "1.2px",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.04) 62%, rgba(255,255,255,0.5))",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      {/* Glossy top highlight — the sheen where light hits the top face. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-t-[32px] bg-gradient-to-b from-white/30 via-white/8 to-transparent"
      />
      {/* Diagonal light sweep across the glass. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/2 left-0 h-[200%] w-1/2 -rotate-12 bg-gradient-to-r from-white/12 to-transparent blur-2xl"
      />
      {/* Soft colour refraction so the glass isn't flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 -top-1/3 h-2/3 w-3/4 rounded-full bg-white/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-12 h-44 w-44 rounded-full bg-sky-300/20 blur-3xl"
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
