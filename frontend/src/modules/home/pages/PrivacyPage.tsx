import HomeNavbar from "../components/HomeNavbar";
import HomeFooter from "../components/HomeFooter";
import Eyebrow from "../components/Eyebrow";
import { usePageMeta } from "@/shared/hooks/usePageMeta";
import {
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
  PRIVACY_UPDATED,
  type PolicySection,
} from "../content/privacyPolicy";

const PRIVACY_META = {
  title: "Privacy policy — Proctavo",
  description:
    "What the Proctavo website and app collect, why, who sees it, and how to have your account and data deleted.",
  path: "/privacy",
};

/**
 * Public privacy policy (proctavo.com/privacy). Linked from the footer and from the
 * Google Play listing. Wording lives in content/privacyPolicy.tsx.
 */
export default function PrivacyPage() {
  usePageMeta(PRIVACY_META);

  return (
    <div className="min-h-screen bg-[#f5f2ec] font-landing text-[#17151f] antialiased selection:bg-indigo-200">
      <HomeNavbar />
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <Eyebrow>Privacy</Eyebrow>
        <h1 className="mt-4 font-editorial text-5xl leading-[1.02] sm:text-6xl">Privacy policy</h1>
        <p className="mt-4 font-landing-mono text-[12px] text-[#8a8494]">Last updated {PRIVACY_UPDATED}</p>
        <p className="mt-6 text-[16px] leading-relaxed text-[#2b2734]">{PRIVACY_INTRO}</p>

        <div className="mt-12 space-y-10">
          {PRIVACY_SECTIONS.map((section) => (
            <PolicyBlock key={section.id} section={section} />
          ))}
        </div>
      </main>
      <HomeFooter />
    </div>
  );
}

function PolicyBlock({ section }: { section: PolicySection }) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2 className="text-2xl font-semibold">{section.heading}</h2>
      {section.paragraphs.map((p, i) => (
        <p key={i} className="mt-3 text-[15.5px] leading-relaxed text-[#2b2734]">
          {p}
        </p>
      ))}
      {section.points && (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15.5px] leading-relaxed text-[#2b2734] marker:text-indigo-400">
          {section.points.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
