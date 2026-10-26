import api from "@/shared/lib/api";
import type { MobileAppInfo, MobileAppInfoResponse } from "../types";

/** Direct link to the APK: a plain browser download, not an axios call. */
export const ANDROID_DOWNLOAD_URL = `${api.defaults.baseURL}/mobile-app/android`;

export const fetchMobileAppInfo = async (): Promise<MobileAppInfo> => {
  const res = await api.get<MobileAppInfoResponse>("/mobile-app");
  return res.data.data;
};
