/**
 * Server push (Expo Push Service → FCM/APNs). The backend mirrors every
 * teacher-facing notification as a push on channel "duty-alerts" with
 * data { type, notificationId, dutyId?, sync: true }.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { ensureChannels } from "@/alarms/native";
import api from "@/lib/api";

const TOKEN_KEY = "push.expoToken";

// Foreground presentation: show server pushes as banners with sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushData {
  type?: string;
  notificationId?: string;
  dutyId?: string;
  sync?: boolean;
  kind?: string;
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Notification permission — needed by server pushes AND by the local alarms. */
export async function ensureNotificationPermission(): Promise<boolean> {
  await ensureChannels(); // Android 13+ shows the permission prompt only once a channel exists
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) {
    perm = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  return perm.granted;
}

/**
 * Fetch the Expo push token and register it with the backend.
 * Needs a role-bound token (POST /push/devices is behind `protect`). Never throws.
 */
export async function registerForPush(): Promise<string | null> {
  try {
    if (Platform.OS === "web" || !Device.isDevice) return null; // simulators can't receive pushes
    if (!(await ensureNotificationPermission())) return null;

    const id = projectId();
    if (!id) {
      console.warn("[push] No EAS projectId in app config — run `eas init`. Push alerts are off for this build.");
      return null;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api.post("/push/devices", {
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: Application.nativeApplicationVersion ?? "dev",
    });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (e) {
    console.warn("[push] registration failed", e);
    return null;
  }
}

/** Tell the backend to stop pushing to this phone. Call BEFORE clearing auth. */
export async function unregisterPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await api.delete("/push/devices", { data: { token } });
  } finally {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export function pushDataOf(n: Notifications.Notification): PushData {
  return (n.request.content.data ?? {}) as PushData;
}
