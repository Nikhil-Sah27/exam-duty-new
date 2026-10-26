import { useQuery } from "@tanstack/react-query";
import { fetchMobileAppInfo } from "../services/mobileAppService";

export const MOBILE_APP_INFO_KEY = ["mobile-app", "info"] as const;

/** Whether an Android build is downloadable, plus its size and date. */
export const useMobileAppInfo = () =>
  useQuery({
    queryKey: MOBILE_APP_INFO_KEY,
    queryFn: fetchMobileAppInfo,
    staleTime: 5 * 60_000,
  });
