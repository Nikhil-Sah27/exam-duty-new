/**
 * "Will anyone hear it?" — reads the phone's silent switch (iOS) and alarm
 * volume (Android) so the app can tell the teacher to fix it before a duty.
 *
 * What each platform allows:
 *   iOS      An app can detect the Ring/Silent switch but never flip it. With
 *            AlarmKit (iOS 26+) duty alarms ring through silent anyway, so only
 *            older iPhones get the "turn silent off" warning.
 *   Android  Duty alarms play on the alarm stream, which silent/vibrate don't
 *            mute — but an alarm volume of zero does, and the app may raise it.
 *
 * react-native-volume-manager is native-only (not in Expo Go), so it is loaded
 * lazily and everything degrades to "unknown" without it.
 */
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { hasAlarmKit, IS_EXPO_GO } from "./native";

type VolumeManagerModule = typeof import("react-native-volume-manager");

let vm: VolumeManagerModule | null | undefined;

function getVolumeManager(): VolumeManagerModule | null {
  if (IS_EXPO_GO || Platform.OS === "web") return null;
  if (vm === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- native module, absent in Expo Go
      vm = require("react-native-volume-manager") as VolumeManagerModule;
    } catch {
      vm = null;
    }
  }
  return vm;
}

export interface SoundStatus {
  /** iOS Ring/Silent switch; null = unknown. */
  silent: boolean | null;
  /** Android alarm-stream volume 0–1; null = unknown. */
  alarmVolume: number | null;
}

const UNKNOWN: SoundStatus = { silent: null, alarmVolume: null };

// Android's getVolume() also reports every stream; the typings only list `volume` (music).
const alarmVolumeOf = (r: { volume: number }) => {
  const v = (r as { alarm?: number }).alarm;
  return typeof v === "number" ? v : null;
};

/** One-off read (for the Settings checklist). iOS reports the switch via a listener, so it waits briefly. */
export async function getSoundStatus(): Promise<SoundStatus> {
  const mod = getVolumeManager();
  if (!mod) return UNKNOWN;
  try {
    if (Platform.OS === "android") {
      return { silent: null, alarmVolume: alarmVolumeOf(await mod.VolumeManager.getVolume()) };
    }
    return await new Promise<SoundStatus>((resolve) => {
      let done = false;
      let sub: { remove(): void } | undefined;
      const finish = (result: SoundStatus) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        sub?.remove();
        resolve(result);
      };
      const timer = setTimeout(() => finish(UNKNOWN), 1500);
      sub = mod.VolumeManager.addSilentListener(({ isMuted }) => finish({ silent: isMuted, alarmVolume: null }));
      if (done) sub.remove(); // answered synchronously, before `sub` was assigned
    });
  } catch {
    return UNKNOWN;
  }
}

/** Live status for banners: follows the silent switch / volume keys while mounted. */
export function useSoundStatus(): SoundStatus {
  const [status, setStatus] = useState<SoundStatus>(UNKNOWN);
  useEffect(() => {
    const mod = getVolumeManager();
    if (!mod) return;
    if (Platform.OS === "ios") {
      const sub = mod.VolumeManager.addSilentListener(({ isMuted }) => setStatus({ silent: isMuted, alarmVolume: null }));
      return () => sub.remove();
    }
    const read = () =>
      mod.VolumeManager.getVolume()
        .then((r) => setStatus({ silent: null, alarmVolume: alarmVolumeOf(r) }))
        .catch(() => undefined);
    void read();
    const sub = mod.VolumeManager.addVolumeListener(() => void read());
    return () => sub.remove();
  }, []);
  return status;
}

/** Android: raise the alarm volume (shows the system slider so the teacher sees it change). */
export async function raiseAlarmVolume(to = 0.8): Promise<boolean> {
  const mod = getVolumeManager();
  if (!mod || Platform.OS !== "android") return false;
  try {
    await mod.VolumeManager.setVolume(to, { type: "alarm", showUI: true });
    return true;
  } catch {
    return false;
  }
}

export interface SoundAdvice {
  tone: "danger" | "warning";
  title: string;
  message: string;
  /** Android only — iOS gives apps no way to flip the switch. */
  fix?: { label: string; run: () => Promise<boolean> };
}

const LOW_ALARM_VOLUME = 0.35;

/** What (if anything) to tell the teacher. Null = alarms will be heard, or we can't tell. */
export function soundAdvice(status: SoundStatus): SoundAdvice | null {
  if (Platform.OS === "ios" && status.silent === true && !hasAlarmKit()) {
    return {
      tone: "danger",
      title: "Your iPhone is on silent",
      message:
        "Duty alarms can't make a sound on silent on this iPhone. Flip the Ring/Silent switch (or the Action button) back to Ring. If the app is open when an alarm goes off, it still rings.",
    };
  }
  if (Platform.OS === "android" && status.alarmVolume !== null && status.alarmVolume < LOW_ALARM_VOLUME) {
    const off = status.alarmVolume === 0;
    return {
      tone: off ? "danger" : "warning",
      title: off ? "Your alarm volume is off" : "Your alarm volume is low",
      message: off
        ? "Duty alarms will be silent. Turn the alarm volume up."
        : "You might not hear duty alarms. Turn the alarm volume up.",
      fix: { label: "Turn it up", run: () => raiseAlarmVolume() },
    };
  }
  return null;
}
