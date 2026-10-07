/**
 * In-app alarm sound: the app itself loops the alarm while the alarm screen is
 * up. It uses the "playback" audio session, which iOS lets a foreground app use
 * even with the Ring/Silent switch on — so an iPhone without AlarmKit (iOS < 26,
 * or the Expo Go preview) still rings out loud once the alarm screen is showing.
 *
 * Android builds with notify-kit already loop the alarm-channel sound on the
 * alarm stream, so the screen stays quiet there instead of ringing twice.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Vibration } from "react-native";

import { getNotifyKit } from "./native";

// Bundled asset — also served by Metro in Expo Go.
const ALARM_SOUND = require("@/assets/sounds/duty_alarm.wav") as number;

const RING_FOR_MS = 10 * 60_000; // same cap as the notification alarm
const FRESH_FOR_MS = 10 * 60_000; // an alarm older than this is history, not ringing
const VIBRATION = [0, 800, 600];

let player: AudioPlayer | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

/** Should the alarm screen ring by itself for an alarm due at `fireAt`? */
export function shouldRingInApp(fireAt: number): boolean {
  if (getNotifyKit()) return false; // the Android alarm notification is already ringing
  const age = Date.now() - fireAt;
  return fireAt > 0 && age > -60_000 && age < FRESH_FOR_MS;
}

/** Loop the alarm sound (+ vibration) until stopped, or for `maxMs`. Never throws. */
export async function startInAppRinging(maxMs = RING_FOR_MS): Promise<void> {
  if (player) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "doNotMix", shouldPlayInBackground: false });
    const p = createAudioPlayer(ALARM_SOUND);
    p.loop = true;
    p.volume = 1;
    p.play();
    player = p;
    Vibration.vibrate(VIBRATION, true);
    stopTimer = setTimeout(stopInAppRinging, maxMs);
  } catch (e) {
    console.warn("[alarms] in-app ringing failed", e);
  }
}

export function stopInAppRinging(): void {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  Vibration.cancel();
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      // already released
    }
    player = null;
  }
}

/** Settings → "Play alarm sound": a few seconds of the real alarm, right now. */
export function playSoundCheck(seconds = 4): Promise<void> {
  stopInAppRinging();
  return startInAppRinging(seconds * 1000);
}
