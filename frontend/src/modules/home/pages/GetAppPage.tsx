import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Smartphone } from "lucide-react";
import HomeNavbar from "../components/HomeNavbar";
import HomeFooter from "../components/HomeFooter";
import Eyebrow from "../components/Eyebrow";
import AndroidDownloadButton from "../components/AndroidDownloadButton";

const ANDROID_STEPS: ReactNode[] = [
  <>
    Open this page on your Android phone and tap <b>Download for Android</b>. If Chrome asks, tap <b>Download anyway</b>.
  </>,
  <>
    Open <b>Proctavo.apk</b> from the download notification or your Files app.
  </>,
  <>
    If asked, allow your browser to <b>install unknown apps</b>, then go back and tap <b>Install</b>. If Play Protect
    warns about an unrecognised app, tap <b>More details → Install anyway</b>.
  </>,
  <>
    Open Proctavo, sign in with your Proctavo email and password, and allow notifications and alarms when asked.
  </>,
];

const CARD = "rounded-3xl border border-[#e6e1d6] bg-white p-7 sm:p-9";

/**
 * Public download page (proctavo.com/app) for the teacher app. The Android APK is
 * served from the server. The iPhone app isn't out yet. Uses the landing page's
 * fixed palette, like the rest of the public site.
 */
export default function GetAppPage() {
  return (
    <div className="min-h-screen bg-[#f5f2ec] font-landing text-[#17151f] antialiased selection:bg-indigo-200">
      <HomeNavbar />
      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <Eyebrow>The Proctavo app</Eyebrow>
        <h1 className="mt-4 max-w-3xl font-editorial text-5xl leading-[1.02] sm:text-6xl">
          Your duties on your phone, <span className="italic text-indigo-600">with an alarm before each one.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[#5a5466]">
          For invigilators, RS, DCS and the exam cell. See and select your duties, get alerts when they change, and hear
          an alarm before every duty, even with the phone on silent.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className={CARD}>
            <h2 className="text-2xl font-semibold">Android</h2>
            <div className="mt-5">
              <AndroidDownloadButton />
            </div>
            <h3 className="mt-9 font-landing-mono text-[11px] uppercase tracking-[0.22em] text-[#8a8494]">
              How to install
            </h3>
            <ol className="mt-4 space-y-4">
              {ANDROID_STEPS.map((step, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-[#2b2734]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-landing-mono text-[12px] font-semibold text-indigo-600">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-[13.5px] text-[#625d6e]">
              You only install it once. Most updates reach the app by themselves.
            </p>
          </section>

          <section className={`${CARD} flex flex-col`}>
            <h2 className="text-2xl font-semibold">iPhone</h2>
            <span className="mt-5 inline-flex w-fit rounded-full bg-[#e6e1d6] px-4 py-1.5 text-[13px] font-medium text-[#625d6e]">
              Coming soon
            </span>
            <p className="mt-5 text-[15px] leading-relaxed text-[#2b2734]">
              The iPhone app is on its way. Until then, sign in to Proctavo in Safari to see and select your duties.
            </p>
            <Link
              to="/login"
              className="mt-5 w-fit text-[14px] font-medium text-indigo-600 transition-colors hover:text-indigo-700"
            >
              Sign in on the web →
            </Link>
          </section>
        </div>

        <p className="mt-10 flex items-start gap-2 text-[14px] leading-relaxed text-[#625d6e]">
          <Smartphone className="mt-1 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
          <span>
            On a computer? Open <b className="font-semibold text-[#17151f]">{window.location.host}/app</b> on your phone
            to download it there.
          </span>
        </p>
      </main>
      <HomeFooter />
    </div>
  );
}
