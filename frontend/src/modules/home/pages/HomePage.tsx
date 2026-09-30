import HomeNavbar from "../components/HomeNavbar";
import HeroSection from "../components/HeroSection";
import HowItWorks from "../components/HowItWorks";
import FeatureSection from "../components/FeatureSection";
import RoleSection from "../components/RoleSection";
import CtaSection from "../components/CtaSection";
import HomeFooter from "../components/HomeFooter";

/**
 * Public Proctavo landing page. Product-grounded: a real app mock in the hero,
 * a concrete "how it works" flow, domain capabilities, and the four roles —
 * composed from focused section components.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <HomeNavbar />
      <main>
        <HeroSection />
        <HowItWorks />
        <FeatureSection />
        <RoleSection />
        <CtaSection />
      </main>
      <HomeFooter />
    </div>
  );
}
