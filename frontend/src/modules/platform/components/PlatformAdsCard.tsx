import { useAdSettings, useSetAdsEnabled } from "../hooks";
import FeatureToggle from "./FeatureToggle";

/**
 * The platform-wide ads master switch (ADS_PLAN.md). Ads show in a college only
 * when this AND the college's own Ads switch are on, so this is the one place
 * to turn every ad off at once.
 */
export default function PlatformAdsCard() {
  const { data, isLoading } = useAdSettings();
  const setEnabled = useSetAdsEnabled();

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-800">Platform settings</h2>
      <FeatureToggle
        label="Ads in the app (all colleges)"
        description="Master switch. When off, no college shows ads, whatever its own Ads switch says."
        checked={Boolean(data?.adsEnabled)}
        disabled={isLoading || setEnabled.isPending}
        onChange={(next) => setEnabled.mutate(next)}
      />
      {setEnabled.error && <p className="text-sm text-red-600">{(setEnabled.error as Error).message}</p>}
    </section>
  );
}
