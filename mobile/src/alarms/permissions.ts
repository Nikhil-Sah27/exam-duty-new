/**
 * "Will my alarm actually ring?" — the checks behind Settings → Alarm health.
 * Each row says what is wrong in plain words and offers the one-tap fix.
 */
import * as Application from "expo-application";
import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";

import { ALARM_CHANNEL_ID, ensureAlarmKitAuthorized, getNotifyKit, hasAlarmKit } from "./native";
import { getSoundStatus, soundAdvice } from "./sound";

export interface HealthItem {
  id: string;
  label: string;
  detail: string;
  /** true = fine, false = will break alarms, null = can't tell (check manually). */
  ok: boolean | null;
  fixLabel?: string;
  fix?: () => Promise<unknown>;
}

const openAppSettings = () => Linking.openSettings();

async function notificationPermission(): Promise<HealthItem> {
  const perm = await Notifications.getPermissionsAsync();
  return {
    id: "notifications",
    label: "Notifications",
    detail: perm.granted ? "Allowed" : "Blocked — you won't get alerts or alarms.",
    ok: perm.granted,
    fixLabel: perm.canAskAgain ? "Allow" : "Open settings",
    fix: perm.canAskAgain ? () => Notifications.requestPermissionsAsync() : openAppSettings,
  };
}

/** Android alarm volume — the one thing that silences an alarm-stream alarm. */
async function alarmVolumeItem(): Promise<HealthItem | null> {
  const status = await getSoundStatus();
  if (status.alarmVolume === null) return null;
  const advice = soundAdvice(status);
  return {
    id: "alarm-volume",
    label: "Alarm volume",
    detail: advice ? advice.message : `${Math.round(status.alarmVolume * 100)}% — loud enough.`,
    ok: advice ? false : true,
    fixLabel: advice?.fix?.label,
    fix: advice?.fix?.run,
  };
}

/** iPhone without AlarmKit: the Ring/Silent switch decides whether alarms make a sound. */
async function silentSwitchItem(): Promise<HealthItem> {
  const { silent } = await getSoundStatus();
  if (silent === null) {
    return {
      id: "ios-legacy",
      label: "Silent mode",
      detail: "On iOS older than 26, alarms play as loud notifications but can't ring while the phone is on silent.",
      ok: null,
    };
  }
  return {
    id: "ios-silent",
    label: "Ring / Silent switch",
    detail: silent
      ? "On silent — duty alarms won't make a sound. Flip the switch (or the Action button) back to Ring."
      : "Ringer on — duty alarms will sound.",
    ok: !silent,
  };
}

export async function getAlarmHealth(): Promise<HealthItem[]> {
  const items: HealthItem[] = [await notificationPermission()];

  if (Platform.OS === "android") {
    const kit = getNotifyKit();
    if (!kit) {
      items.push({
        id: "engine",
        label: "Alarm engine",
        detail: "Full alarm support is missing from this build — alarms fall back to plain notifications.",
        ok: false,
      });
      return items;
    }
    const n = kit.default;
    const { AndroidNotificationSetting } = kit;
    const settings = await n.getNotificationSettings();

    items.push({
      id: "exact",
      label: "Alarms & reminders",
      detail:
        settings.android.alarm === AndroidNotificationSetting.ENABLED
          ? "Allowed — alarms ring on the minute."
          : "Not allowed — Android may ring late.",
      ok: settings.android.alarm === AndroidNotificationSetting.ENABLED,
      fixLabel: "Allow",
      fix: () => n.openAlarmPermissionSettings(),
    });

    const fsi = settings.android.fullScreenIntent;
    items.push({
      id: "fullscreen",
      label: "Full-screen alarm",
      detail:
        fsi === AndroidNotificationSetting.DISABLED
          ? "Off — the alarm shows as a notification instead of taking over the lock screen."
          : "Allowed — the alarm takes over the lock screen.",
      ok: fsi !== AndroidNotificationSetting.DISABLED,
      fixLabel: "Allow",
      fix: () =>
        IntentLauncher.startActivityAsync("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT", {
          data: `package:${Application.applicationId}`,
        }).catch(openAppSettings),
    });

    const volume = await alarmVolumeItem();
    if (volume) items.push(volume);

    const blocked = await n.isChannelBlocked(ALARM_CHANNEL_ID).catch(() => false);
    items.push({
      id: "channel",
      label: "Duty alarm sound",
      detail: blocked ? "The \"Duty alarms\" category is turned off." : "On",
      ok: !blocked,
      fixLabel: "Turn on",
      fix: () => n.openNotificationSettings(ALARM_CHANNEL_ID),
    });

    const optimized = await n.isBatteryOptimizationEnabled().catch(() => false);
    items.push({
      id: "battery",
      label: "Battery optimisation",
      detail: optimized
        ? "On — the phone may hold back alerts. Set Proctavo to \"Unrestricted\"."
        : "Off for Proctavo — good.",
      ok: !optimized,
      fixLabel: "Fix",
      fix: () => n.openBatteryOptimizationSettings(),
    });

    const power = await n.getPowerManagerInfo().catch(() => null);
    if (power?.activity) {
      items.push({
        id: "autostart",
        label: `Auto-start (${power.manufacturer ?? "this phone"})`,
        detail: "Some phones stop apps in the background. Allow Proctavo to auto-start.",
        ok: null,
        fixLabel: "Open",
        fix: () => n.openPowerManagerSettings(),
      });
    }
    return items;
  }

  if (Platform.OS === "ios") {
    if (hasAlarmKit()) {
      const authorized = await ensureAlarmKitAuthorized();
      items.push({
        id: "alarmkit",
        label: "Alarms",
        detail: authorized
          ? "Allowed — duty alarms ring even in silent mode and Focus."
          : "Not allowed — alarms fall back to notifications that respect silent mode.",
        ok: authorized,
        fixLabel: "Open settings",
        fix: openAppSettings,
      });
    } else {
      items.push(await silentSwitchItem());
    }
  }
  return items;
}
