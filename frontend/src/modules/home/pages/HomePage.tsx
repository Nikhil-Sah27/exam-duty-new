import HomeNavbar from "../components/HomeNavbar";
import HeroSection from "../components/HeroSection";
import FeatureSection from "../components/FeatureSection";
import RoleSection from "../components/RoleSection";
import CtaSection from "../components/CtaSection";
import HomeFooter from "../components/HomeFooter";

/**
 * Public Proctavo landing page. Dark, indigo/violet-accented theme to match the
 * app's chrome. Composed from focused section components (nav, hero, features,
 * roles, CTA, footer) for a clean, component-based structure.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Base gradient wash consistent with the app's dark surfaces */}
      <div className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <HomeNavbar />
        <main>
          <HeroSection />
          <FeatureSection />
          <RoleSection />
          <CtaSection />
        </main>
        <HomeFooter />
      </div>
    </div>
  );
}
