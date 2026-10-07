/**
 * Background wiring that only runs for a signed-in Invigilator / RS / DCS:
 * device registration, alarm sync on every foreground, push listeners and
 * alarm-screen routing. Renders nothing.
 */
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { findRingingAlarm, fromAlarmData, getLaunchAlarm, subscribeAlarmEvents, syncAlarms } from "@/alarms";
import { afterSignedIn } from "@/features/auth/session";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { pushDataOf } from "@/push";
import { openAlarmScreen, openFromPush } from "@/runtime/navigation";
import { useAuthStore } from "@/store/auth";

const FOREGROUND_SYNC_EVERY_MS = 30_000;

async function showRingingAlarm() {
  const ringing = await findRingingAlarm();
  const payload = ringing ? fromAlarmData(ringing.data) : null;
  if (ringing && payload) openAlarmScreen(payload, ringing.notificationId, true);
}

function handleResponse(response: Notifications.NotificationResponse) {
  const data = pushDataOf(response.notification);
  const alarm = fromAlarmData(data as Record<string, unknown>);
  if (alarm) {
    openAlarmScreen(alarm, response.notification.request.identifier);
    return;
  }
  void openFromPush(data);
}

export function TeacherRuntime() {
  const token = useAuthStore((s) => s.token);
  const lastSync = useRef(0);

  // Register this phone + schedule alarms once per signed-in session/role.
  useEffect(() => {
    if (!token) return;
    lastSync.current = Date.now();
    void afterSignedIn();
  }, [token]);

  // Every return to the foreground: re-sync alarms (throttled) and surface a ringing alarm.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void showRingingAlarm();
      if (Date.now() - lastSync.current > FOREGROUND_SYNC_EVERY_MS) {
        lastSync.current = Date.now();
        void syncAlarms();
      }
    });
    return () => sub.remove();
  }, []);

  // Server pushes: anything duty-related may have changed → refresh + re-sync.
  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((n) => {
      const alarm = fromAlarmData(pushDataOf(n) as Record<string, unknown>);
      if (alarm) {
        // One of our own alarms fired while the app is open: bring up the alarm
        // screen, which rings out loud even on silent.
        openAlarmScreen(alarm, n.request.identifier);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myUnits });
      lastSync.current = Date.now();
      void syncAlarms();
    });
    const tapped = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // Cold start from a tapped push / iOS alarm notification.
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last) {
        handleResponse(last);
        void Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => {
      received.remove();
      tapped.remove();
    };
  }, []);

  // Android alarm events + cold start from a full-screen alarm.
  useEffect(() => {
    const unsubscribe = subscribeAlarmEvents((payload, id) => openAlarmScreen(payload, id));
    void getLaunchAlarm().then((launch) => {
      if (launch) openAlarmScreen(launch.payload, launch.notificationId, true);
      else void showRingingAlarm();
    });
    return unsubscribe;
  }, []);

  return null;
}
