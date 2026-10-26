/**
 * Background wiring that only runs for a signed-in Invigilator / RS / DCS:
 * device registration, alarm sync on every foreground, push listeners
 * (usePushListeners) and alarm-screen routing. Renders nothing.
 */
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { findRingingAlarm, fromAlarmData, getLaunchAlarm, subscribeAlarmEvents, syncAlarms } from "@/alarms";
import { afterSignedIn } from "@/features/auth/session";
import { pushDataOf } from "@/push";
import { openAlarmScreen } from "@/runtime/navigation";
import { usePushListeners } from "@/runtime/usePushListeners";
import { useAuthStore } from "@/store/auth";

const FOREGROUND_SYNC_EVERY_MS = 30_000;

async function showRingingAlarm() {
  const ringing = await findRingingAlarm();
  const payload = ringing ? fromAlarmData(ringing.data) : null;
  if (ringing && payload) openAlarmScreen(payload, ringing.notificationId, true);
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

  // Server pushes (shared wiring) + our own duty alarms, which open the alarm
  // screen; any other push may have moved a duty → re-sync the alarms.
  usePushListeners({
    intercept: (n) => {
      const alarm = fromAlarmData(pushDataOf(n) as Record<string, unknown>);
      if (!alarm) return false;
      // Rings out loud even on silent, whether it fired in the app or was tapped.
      openAlarmScreen(alarm, n.request.identifier);
      return true;
    },
    onReceived: () => {
      lastSync.current = Date.now();
      void syncAlarms();
    },
  });

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
