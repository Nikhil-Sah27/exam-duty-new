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

/**
 * Public Proctavo landing page. Editorial, warm-paper design with a live demo in
 * the hero (ClaimDemo) — every claim on it describes how the product actually
 * behaves. Fixed palette by design: it doesn't follow the in-app theme toggle.
 */
export default function HomePage() {
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
