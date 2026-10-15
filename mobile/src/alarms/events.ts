/**
 * Android alarm notification events (notify-kit). The action buttons on a
 * ringing alarm — Dismiss / Snooze 5 min / I'm on my way — must work even when
 * the app was killed, so the same handler is registered as the background
 * handler from the app entry (index.ts) and as a foreground listener.
 */
import type { Event } from "react-native-notify-kit";

import { confirmDuty } from "@/features/duties/api";
import { useAuthStore } from "@/store/auth";

import { snoozeAlarm } from "./engine";
import { getNotifyKit, stopRinging } from "./native";
import { fromAlarmData, type AlarmPayload } from "./plan";

/** Confirm the duty from an alarm ("I'm on my way"). Works headless: hydrates auth first. */
export async function confirmFromAlarm(p: AlarmPayload): Promise<boolean> {
  if (!p.primaryDutyId || p.test) return false;
  const store = useAuthStore.getState();
  if (!store.isHydrated) await store.hydrate();
  if (!useAuthStore.getState().token) return false;
  try {
    await confirmDuty(p.primaryDutyId);
    return true;
  } catch {
    return false; // already confirmed, cancelled, or offline — the alarm still stops
  }
}

async function handleEvent({ type, detail }: Event): Promise<void> {
  const kit = getNotifyKit();
  if (!kit || type !== kit.EventType.ACTION_PRESS) return;
  const notificationId = detail.notification?.id;
  const payload = fromAlarmData(detail.notification?.data as Record<string, unknown> | undefined);
  if (!payload || !notificationId) return;

  switch (detail.pressAction?.id) {
    case "dismiss":
      await stopRinging(notificationId);
      break;
    case "snooze":
      await snoozeAlarm(payload, notificationId);
      break;
    case "on-my-way":
      await stopRinging(notificationId);
      await confirmFromAlarm(payload);
      break;
  }
}

export function registerAlarmBackgroundHandler(): void {
  getNotifyKit()?.default.onBackgroundEvent(handleEvent);
}

/**
 * Foreground listener. Body/full-screen presses open the alarm screen through
 * `onOpenAlarm`; action buttons are handled exactly like in the background.
 */
export function subscribeAlarmEvents(onOpenAlarm: (payload: AlarmPayload, notificationId: string) => void): () => void {
  const kit = getNotifyKit();
  if (!kit) return () => undefined;
  return kit.default.onForegroundEvent((event) => {
    const { type, detail } = event;
    if (type === kit.EventType.PRESS) {
      const payload = fromAlarmData(detail.notification?.data as Record<string, unknown> | undefined);
      if (payload && detail.notification?.id) onOpenAlarm(payload, detail.notification.id);
      return;
    }
    void handleEvent(event);
  });
}

/** Cold start from a full-screen alarm or a tap on it. */
export async function getLaunchAlarm(): Promise<{ payload: AlarmPayload; notificationId: string } | null> {
  const kit = getNotifyKit();
  if (!kit) return null;
  const initial = await kit.default.getInitialNotification().catch(() => null);
  const payload = fromAlarmData(initial?.notification?.data as Record<string, unknown> | undefined);
  if (!payload || !initial?.notification?.id) return null;
  // "I'm on my way" launches the app too, but it has already been handled.
  if (initial.pressAction?.id === "on-my-way") return null;
  return { payload, notificationId: initial.notification.id };
}
