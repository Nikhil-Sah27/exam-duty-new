import { useState, type FormEvent, type ComponentType } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  DoorOpen,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  type LucideProps,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLogin } from "../hooks";
import { GlassCard, ProctavoBrand, Field, GLASS_INPUT } from "./authShell";
import ForgotPasswordView from "./ForgotPasswordView";
import LoginBackground from "./LoginBackground";

interface Feature {
  icon: ComponentType<LucideProps>;
  title: string;
  desc: string;
  /** Tailwind bg for the icon tile. */
  tile: string;
}

// Four headline capabilities of the platform, each on its own accent tile.
const FEATURES: Feature[] = [
  {
    icon: Users,
    title: "Duty Management",
    desc: "Assign and manage invigilation duties easily.",
    tile: "bg-gradient-to-br from-blue-500 to-blue-600",
  },
  {
    icon: CalendarDays,
    title: "Exam Scheduling",
    desc: "Plan and organize exams with ease.",
    tile: "bg-gradient-to-br from-violet-500 to-purple-600",
  },
  {
    icon: DoorOpen,
    title: "Room Allocation",
    desc: "Optimize room usage and seating.",
    tile: "bg-gradient-to-br from-emerald-500 to-teal-600",
  },
  {
    icon: Bell,
    title: "Real-time Updates",
    desc: "Stay informed with instant notifications.",
    tile: "bg-gradient-to-br from-amber-500 to-orange-600",
  },
];

const STATS: { big: string; small: string }[] = [
  { big: "Organized", small: "Exams" },
  { big: "Efficient", small: "Duty Allocation" },
  { big: "Better", small: "Institution Experience" },
];

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginBackground />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center gap-10 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-12">
        {/* ── Brand / features (left) ─────────────────────────────── */}
        <section className="hidden max-w-xl flex-1 text-white lg:block">
          <ProctavoBrand className="h-12" />

          <h1 className="mt-8 text-4xl font-extrabold leading-tight xl:text-5xl">
            Smarter <span className="text-blue-400">Exams.</span>
            <br />
            Smoother <span className="text-blue-400">Operations.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
            Efficient duty allocation, seamless coordination and hassle-free exam
            management for your institution.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md ${f.tile}`}
                >
                  <f.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{f.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-white/65">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-6">
            {STATS.map((s, i) => (
              <div key={s.big} className="flex items-center gap-6">
                {i > 0 && <span className="h-8 w-px bg-white/20" />}
                <div>
                  <p className="text-lg font-extrabold text-white">{s.big}</p>
                  <p className="text-[11px] text-white/60">{s.small}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Liquid-glass auth card (right) ──────────────────────── */}
        <section className="w-full max-w-md">
          {mode === "forgot" ? (
            <ForgotPasswordView onBack={() => setMode("login")} />
          ) : (
            <GlassCard>
              <ProctavoBrand center onDark />

              <div className="mt-6 text-center">
                <h2 className="text-2xl font-bold text-white drop-shadow-sm">
                  Welcome Back
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  Sign in to continue to Proctavo
                </p>
              </div>

              {login.isError && (
                <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-300/40 bg-red-500/20 px-3 py-2.5 text-sm text-red-100 backdrop-blur-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{login.error.message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <Field
                  id="email"
                  label="Email"
                  icon={Mail}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@institution.edu"
                />

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-semibold text-white/80"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={`${GLASS_INPUT} pl-10 pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-medium text-sky-300 transition-colors hover:text-sky-200"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={login.isPending}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/40 ring-1 ring-inset ring-white/20 transition-all hover:from-blue-500 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {login.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-white/60">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Secured, role-based access — you'll land on your dashboard
                automatically.
              </p>
            </GlassCard>
          )}
        </section>
      </div>
    </div>
  );
}
