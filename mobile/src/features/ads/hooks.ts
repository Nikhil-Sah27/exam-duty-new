import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { queryKeys } from "@/lib/queryKeys";
import { isTeacherRole } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";

import { AD_UNITS } from "./adUnits";
import { fetchAdStatus } from "./api";
import { startAds } from "./sdk";
import type { AdLevel } from "./types";

/**
 * The teacher's ad level and reasons, from the backend. Refreshes with the
 * app's other queries when it returns to the foreground, and after a duty is
 * claimed (select-duty CLAIM_INVALIDATIONS). CS never asks.
 */
export function useAdStatus() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.activeRole ?? null);
  return useQuery({
    queryKey: queryKeys.adStatus,
    queryFn: fetchAdStatus,
    enabled: !!token && isTeacherRole(role),
    staleTime: 60_000,
  });
}

/**
 * The level the screens act on: the backend's level once the ad SDK is up,
 * otherwise 0 — so nothing shows while consent and start-up are pending, or
 * ever in a build with no ad units.
 */
export function useAdLevel(): AdLevel {
  const level = useAdStatus().data?.level ?? 0;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (level === 0 || ready || !AD_UNITS.banner) return;
    let live = true;
    void startAds().then((ok) => {
      if (live) setReady(ok);
    });
    return () => {
      live = false;
    };
  }, [level, ready]);

  return ready ? level : 0;
}
