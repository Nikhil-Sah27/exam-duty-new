/**
 * Platform alarm backends. Callers only see schedule/cancel/stop; which engine
 * rings is decided here:
 *
 *   Android        → react-native-notify-kit: AlarmManager alarm-clock trigger,
 *                    looping sound on the `duty-alarm` channel (USAGE_ALARM, so
 *                    it plays on the alarm stream through silent/DND), full-screen
 *                    intent, Dismiss / Snooze / I'm on my way actions.
 *   iOS 26+        → AlarmKit (system alarm UI, breaks through silent & Focus).
 *   iOS < 26 / any → expo-notifications scheduled notification with the alarm
 *   failure          sound (time-sensitive; respects the silent switch).
 *
 * The native modules are required lazily and per platform: notify-kit is only
 * linked on Android and AlarmKit only on iOS (see react-native.config.js).
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { toAlarmData, type AlarmPayload } from "./plan";

export const ALARM_CHANNEL_ID = "duty-alarm";
export const ALERT_CHANNEL_ID = "duty-alerts";
export const ALARM_SOUND_FILE = "duty_alarm.wav";
const ALARM_SOUND_NAME = "duty_alarm";
const RING_FOR_MS = 10 * 60_000; // an unattended alarm stops ringing after 10 min
const BRAND = "#6366f1";

export type Backend = "notifee" | "alarmkit" | "expo";

type NotifyKit = typeof import("react-native-notify-kit");
type AlarmKit = typeof import("react-native-nitro-ios-alarm-kit");

let notifyKit: NotifyKit | null | undefined;
let alarmKit: AlarmKit | null | undefined;

export function getNotifyKit(): NotifyKit | null {
  if (Platform.OS !== "android") return null;
  if (notifyKit === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Android-only native module, loaded lazily
      notifyKit = require("react-native-notify-kit") as NotifyKit;
    } catch (e) {
      console.warn("[alarms] notify-kit unavailable, falling back to expo-notifications", e);
      notifyKit = null;
    }
  }
  return notifyKit;
}

function getAlarmKit(): AlarmKit | null {
  if (Platform.OS !== "ios") return null;
  if (alarmKit === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- iOS-only native module, loaded lazily
      const mod = require("react-native-nitro-ios-alarm-kit") as AlarmKit;
      alarmKit = mod.isAvailable() ? mod : null;
    } catch {
      alarmKit = null;
    }
  }
  return alarmKit;
}

export const hasAlarmKit = () => getAlarmKit() !== null;

let alarmKitAuthorized: boolean | undefined;

/** Ask (once per launch) for AlarmKit access. Returns false where AlarmKit doesn't exist. */
export async function ensureAlarmKitAuthorized(): Promise<boolean> {
  const kit = getAlarmKit();
  if (!kit) return false;
  if (alarmKitAuthorized === undefined) {
    try {
      alarmKitAuthorized = await kit.requestAlarmPermission();
    } catch {
      alarmKitAuthorized = false;
    }
  }
  return alarmKitAuthorized;
}

/** Android channels. Created through expo-notifications because only it can set
 *  USAGE_ALARM audio attributes; notify-kit then posts into the same channel. */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
    name: "Duty alarms",
    description: "Rings like an alarm clock before each exam duty.",
    importance: Notifications.AndroidImportance.MAX,
    sound: ALARM_SOUND_FILE,
    bypassDnd: true,
    enableVibrate: true,
    vibrationPattern: [0, 800, 400, 800, 400, 800],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      flags: { enforceAudibility: true, requestHardwareAudioVideoSynchronization: false },
    },
  });
  // Server pushes (assignments, changes, reminders) — the backend sends channelId "duty-alerts".
  await Notifications.setNotificationChannelAsync(ALERT_CHANNEL_ID, {
    name: "Duty alerts",
    description: "Assignments, changes, reminders and announcements.",
    importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function androidAlarmNotification(kit: NotifyKit, p: AlarmPayload) {
  const { AndroidCategory, AndroidImportance, AndroidVisibility } = kit;
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    data: toAlarmData(p),
    android: {
      channelId: ALARM_CHANNEL_ID,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      smallIcon: "notification_icon",
      color: BRAND,
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      lightUpScreen: true,
      timeoutAfter: RING_FOR_MS,
      showTimestamp: true,
      timestamp: new Date(p.startsAt).getTime() || p.fireAt,
      pressAction: { id: "default", launchActivity: "default" },
      // mainComponent "main" is the app itself; it only tags the launch so
      // MainActivity may show over the lock screen (plugins/withAlarmLockScreen.js).
      fullScreenAction: { id: "alarm", launchActivity: "default", mainComponent: "main" },
      actions: [
        { title: "Dismiss", pressAction: { id: "dismiss" } },
        { title: "Snooze 5 min", pressAction: { id: "snooze" } },
        { title: "I'm on my way", pressAction: { id: "on-my-way", launchActivity: "default" } },
      ],
    },
  };
}

async function scheduleExpo(p: AlarmPayload): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    identifier: p.id,
    content: {
      title: p.title,
      body: p.body,
      data: toAlarmData(p),
      sound: ALARM_SOUND_FILE,
      interruptionLevel: "timeSensitive",
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(p.fireAt), channelId: ALARM_CHANNEL_ID },
  });
}

/** Schedule one alarm; returns the native id + which engine holds it. */
export async function scheduleNative(p: AlarmPayload): Promise<{ nativeId: string; backend: Backend }> {
  const kit = getNotifyKit();
  if (kit) {
    const nativeId = await kit.default.createTriggerNotification(androidAlarmNotification(kit, p), {
      type: kit.TriggerType.TIMESTAMP,
      timestamp: p.fireAt,
      alarmManager: { type: kit.AlarmType.SET_ALARM_CLOCK },
    });
    return { nativeId, backend: "notifee" };
  }

  const ak = getAlarmKit();
  if (ak && (await ensureAlarmKitAuthorized())) {
    try {
      const nativeId = await ak.scheduleFixedAlarm(
        p.shortTitle,
        { text: "Stop", textColor: "#FFFFFF", icon: "checkmark.circle.fill" },
        BRAND,
        { text: "Snooze", textColor: "#FFFFFF", icon: "zzz" },
        Math.floor(p.fireAt / 1000),
        { postAlert: 300 },
        ALARM_SOUND_NAME,
      );
      if (nativeId) return { nativeId, backend: "alarmkit" };
    } catch (e) {
      console.warn("[alarms] AlarmKit schedule failed, using a notification instead", e);
    }
  }

  return { nativeId: await scheduleExpo(p), backend: "expo" };
}

export async function cancelNative(nativeId: string, backend: Backend): Promise<void> {
  try {
    if (backend === "notifee") await getNotifyKit()?.default.cancelTriggerNotification(nativeId);
    else if (backend === "alarmkit") await getAlarmKit()?.stopAlarm(nativeId);
    else await Notifications.cancelScheduledNotificationAsync(nativeId);
  } catch (e) {
    console.warn("[alarms] cancel failed", backend, nativeId, e);
  }
}

/** Silence a ringing (already-fired) alarm. */
export async function stopRinging(notificationId: string): Promise<void> {
  const kit = getNotifyKit();
  if (kit) await kit.default.cancelDisplayedNotification(notificationId).catch(() => undefined);
  else await Notifications.dismissNotificationAsync(notificationId).catch(() => undefined);
}

/** Wipe every alarm this app ever scheduled (logout / alarms switched off). */
export async function cancelEverything(): Promise<void> {
  const kit = getNotifyKit();
  if (kit) await kit.default.cancelTriggerNotifications().catch(() => undefined);
  const ak = getAlarmKit();
  if (ak) await ak.stopAllAlarms().catch(() => undefined);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === "duty-alarm")
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined)),
  );
}

/** A duty alarm currently on screen / ringing (Android), if any. */
export async function findRingingAlarm(): Promise<{ notificationId: string; data: Record<string, unknown> } | null> {
  const kit = getNotifyKit();
  if (!kit) return null;
  const shown = await kit.default.getDisplayedNotifications().catch(() => []);
  for (const item of shown) {
    const data = item.notification?.data as Record<string, unknown> | undefined;
    if (data?.kind === "duty-alarm" && item.notification?.id) {
      return { notificationId: item.notification.id, data };
    }
  }
  return null;
}
