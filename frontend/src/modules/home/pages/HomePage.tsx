import HomeNavbar from "../components/HomeNavbar";
import HeroSection from "../components/HeroSection";
import ProofRow from "../components/ProofRow";
import HowItWorks from "../components/HowItWorks";
import ReminderBand from "../components/ReminderBand";
import FeatureSection from "../components/FeatureSection";
import RoleSection from "../components/RoleSection";
import PhoneSection from "../components/PhoneSection";
import CtaSection from "../components/CtaSection";
import HomeFooter from "../components/HomeFooter";
import { usePageMeta } from "@/shared/hooks/usePageMeta";

// The same title and description are static in index.html, for crawlers and link
// previews that don't run JS. Change both together.
const HOME_META = {
  title: "Proctavo — Exam duty & invigilation planner for colleges",
  description:
    "Turn your exam timetable, rooms and faculty into a fair invigilation roster. Assign in a click, let teachers pick or swap duties, with reminders and phone alarms.",
  path: "/",
};

/**
 * Public Proctavo landing page. Editorial, warm-paper design with a live demo in
 * the hero (ClaimDemo) — every claim on it describes how the product actually
 * behaves. Fixed palette by design: it doesn't follow the in-app theme toggle.
 */
export default function HomePage() {
  usePageMeta(HOME_META);

  return (
    <div className="min-h-screen bg-[#f5f2ec] font-landing text-[#17151f] antialiased selection:bg-indigo-200">
      <HomeNavbar />
      <main>
        <HeroSection />
        <ProofRow />
        <HowItWorks />
        <ReminderBand />
        <FeatureSection />
        <RoleSection />
        <PhoneSection />
        <CtaSection />
      </main>
      <HomeFooter />
    </div>
  );
}
