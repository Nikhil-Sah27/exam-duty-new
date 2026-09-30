import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { useForgotPassword, useResetPassword } from "../hooks";
import { GlassCard, ProctavoBrand, Field, GLASS_INPUT } from "./authShell";

type Step = "request" | "reset" | "done";

/**
 * Password reset via an emailed OTP. Two steps in one glass card:
 *   1. enter email → server emails a 6-digit code
 *   2. enter the code + a new password → password updated
 * On success it shows a confirmation and a link back to sign-in.
 */
export default function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const forgot = useForgotPassword();
  const reset = useResetPassword();

  const submitRequest = (e: FormEvent) => {
    e.preventDefault();
    forgot.mutate(email, { onSuccess: () => setStep("reset") });
  };

  const submitReset = (e: FormEvent) => {
    e.preventDefault();
    reset.mutate(
      { email, otp, newPassword },
      { onSuccess: () => setStep("done") },
    );
  };

  return (
    <GlassCard>
      <ProctavoBrand center onDark />

      {step === "done" ? (
        <div className="mt-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-2xl font-bold text-white">Password updated</h2>
          <p className="mt-1 text-sm text-white/70">
            You can now sign in with your new password.
          </p>
          <button
            onClick={onBack}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/40 ring-1 ring-inset ring-white/20 transition-all hover:from-blue-500 hover:to-blue-400"
          >
            Back to Sign In
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-bold text-white drop-shadow-sm">
              {step === "request" ? "Reset password" : "Enter reset code"}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              {step === "request"
                ? "We'll email a 6-digit code to your registered address."
                : `Enter the code sent to ${email} and choose a new password.`}
            </p>
          </div>

          {(forgot.isError || reset.isError) && (
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-300/40 bg-red-500/20 px-3 py-2.5 text-sm text-red-100 backdrop-blur-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {(forgot.error as Error)?.message ||
                  (reset.error as Error)?.message}
              </span>
            </div>
          )}

          {step === "request" ? (
            <form onSubmit={submitRequest} className="mt-6 space-y-5">
              <Field
                id="reset-email"
                label="Email"
                icon={Mail}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@institution.edu"
              />
              <SubmitButton loading={forgot.isPending} label="Send reset code" />
            </form>
          ) : (
            <form onSubmit={submitReset} className="mt-6 space-y-5">
              <Field
                id="reset-otp"
                label="Reset code"
                icon={KeyRound}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6-digit code"
              />

              <div>
                <label
                  htmlFor="new-password"
                  className="mb-1.5 block text-sm font-semibold text-white/80"
                >
                  New password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={`${GLASS_INPUT} pl-10 pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <SubmitButton loading={reset.isPending} label="Reset password" />

              <button
                type="button"
                onClick={() => forgot.mutate(email)}
                disabled={forgot.isPending}
                className="w-full text-center text-xs font-medium text-sky-300 hover:text-sky-200 disabled:opacity-60"
              >
                {forgot.isPending ? "Resending…" : "Resend code"}
              </button>
            </form>
          )}
        </>
      )}

      <button
        onClick={onBack}
        className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-white/70 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </button>
    </GlassCard>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/40 ring-1 ring-inset ring-white/20 transition-all hover:from-blue-500 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Please wait…
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}
