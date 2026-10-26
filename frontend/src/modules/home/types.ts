/** The Android build offered at /app. `available` is false until an APK is uploaded to the server. */
export interface AndroidRelease {
  available: boolean;
  version?: string | null;
  sizeBytes?: number;
  updatedAt?: string;
}

export interface MobileAppInfo {
  android: AndroidRelease;
}

export interface MobileAppInfoResponse {
  success: boolean;
  data: MobileAppInfo;
}
