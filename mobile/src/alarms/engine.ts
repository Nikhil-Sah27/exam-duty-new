/**
 * The on-device alarm engine: keeps the phone's scheduled alarms equal to
 * "my live upcoming duty units × my alarm settings".
 *
 * syncAlarms() is idempotent and cheap when nothing changed, so it is called
 * liberally — app start, every return to the foreground, every push received,
 * after confirm, after a Select Duty claim, after a settings change. A duty
 * that is cancelled or moved loses (or moves) its alarm on the next sync.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { fetchMyUnits } from "@/features/duties/api";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { isTeacherRole } from "@/lib/roles";
import type { DutyUnit } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

import { cancelEverything, cancelNative, ensureChannels, scheduleNative, stopRinging, type Backend } from "./native";
import { planAlarms, type AlarmPayload } from "./plan";
import { loadAlarmSettings } from "./settings";

interface ScheduledEntry {
  nativeId: string;
  backend: Backend;
  fireAt: number;
  fingerprint: string;
  title: string;
}

type ScheduledMap = Record<string, ScheduledEntry>;

const STORE_KEY = "alarms.scheduled.v1";

async function readScheduled(): Promise<ScheduledMap> {
  try {
    return JSON.parse((await AsyncStorage.getItem(STORE_KEY)) || "{}") as ScheduledMap;
  } catch {
    return {};
  }
}

const writeScheduled = (map: ScheduledMap) => AsyncStorage.setItem(STORE_KEY, JSON.stringify(map));

/** UI-facing summary of what the engine last did. */
interface AlarmState {
  nextAlarm: { fireAt: number; title: string } | null;
  scheduledCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

export const useAlarmState = create<AlarmState>(() => ({
  nextAlarm: null,
  scheduledCount: 0,
  lastSyncAt: null,
  lastError: null,
}));

function publish(map: ScheduledMap, error: string | null = null) {
  const now = Date.now();
  const upcoming = Object.values(map)
    .filter((e) => e.fireAt > now)
    .sort((a, b) => a.fireAt - b.fireAt);
  useAlarmState.setState({
    nextAlarm: upcoming[0] ? { fireAt: upcoming[0].fireAt, title: upcoming[0].title } : null,
    scheduledCount: upcoming.length,
    lastSyncAt: now,
    lastError: error,
  });
}

async function reconcile(units: DutyUnit[]): Promise<void> {
  const settings = await loadAlarmSettings();
  const desired = planAlarms(units, settings);
  const desiredById = new Map(desired.map((a) => [a.id, a]));
  const scheduled = await readScheduled();
  const now = Date.now();
  const next: ScheduledMap = {};

  for (const [id, entry] of Object.entries(scheduled)) {
    // Already fired: forget it, but never cancel — it may be ringing right now.
    if (entry.fireAt <= now) continue;
    const want = desiredById.get(id);
    if (want && want.fingerprint === entry.fingerprint && want.fireAt === entry.fireAt) {
      next[id] = entry; // unchanged
    } else {
      await cancelNative(entry.nativeId, entry.backend);
    }
  }

  for (const alarm of desired) {
    if (next[alarm.id]) continue;
    try {
      const { nativeId, backend } = await scheduleNative(alarm);
      next[alarm.id] = { nativeId, backend, fireAt: alarm.fireAt, fingerprint: alarm.fingerprint, title: alarm.title };
    } catch (e) {
      console.warn("[alarms] could not schedule", alarm.id, e);
    }
  }

  await writeScheduled(next);
  publish(next);
}

let running: Promise<void> | null = null;
let rerun = false;

/**
 * Bring scheduled alarms in line with the server. Pass `units` when you already
 * have a fresh list; otherwise it is fetched (and the shared query cache updated).
 * Concurrent calls coalesce into at most one extra run.
 */
export function syncAlarms(units?: DutyUnit[]): Promise<void> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    try {
      const { token, user } = useAuthStore.getState();
      if (!token || !isTeacherRole(user?.activeRole)) return;
      await ensureChannels();
      const list = units ?? (await fetchMyUnits());
      if (!units) queryClient.setQueryData(queryKeys.myUnits, list);
      await reconcile(list);
    } catch (e) {
      // Offline or server error: keep whatever is already scheduled — a stale
      // alarm beats a missing one, and the alarm screen re-checks the duty.
      const message = e instanceof Error ? e.message : String(e);
      useAlarmState.setState({ lastError: message });
    } finally {
      running = null;
      if (rerun) {
        rerun = false;
        void syncAlarms();
      }
    }
  })();
  return running;
}

/** Remove every scheduled alarm (logout, or alarms switched off). */
export async function cancelAllAlarms(): Promise<void> {
  const scheduled = await readScheduled();
  await Promise.all(
    Object.values(scheduled)
      .filter((e) => e.fireAt > Date.now())
      .map((e) => cancelNative(e.nativeId, e.backend)),
  );
  await cancelEverything();
  await writeScheduled({});
  publish({});
}

/** Ring again in 5 minutes (outside the reconciled set, like a snoozed clock alarm). */
export async function snoozeAlarm(p: AlarmPayload, ringingNotificationId?: string, minutes = 5): Promise<number> {
  if (ringingNotificationId) await stopRinging(ringingNotificationId);
  const fireAt = Date.now() + minutes * 60_000;
  const base = p.id.replace(/#snooze.*$/, "");
  await scheduleNative({ ...p, id: `${base}#snooze${fireAt}`, fireAt, lead: "snooze", title: `Snoozed · ${p.title}` });
  return fireAt;
}

/** "Test alarm now" — rings in `seconds` with sample text; not tracked by sync. */
export async function scheduleTestAlarm(seconds = 10): Promise<number> {
  await ensureChannels();
  const fireAt = Date.now() + seconds * 1000;
  await scheduleNative({
    id: `test:${fireAt}`,
    fireAt,
    title: "Test alarm · Exam duty",
    body: "This is how your duty alarm will sound. Tap Dismiss to stop it.",
    shortTitle: "Test alarm",
    unitKey: "",
    primaryDutyId: "",
    startsAt: new Date(fireAt + 60 * 60_000).toISOString(),
    lead: "test",
    test: true,
  });
  return fireAt;
}

/** Alarms scheduled for one unit (duty detail screen). */
export async function alarmsForUnit(unitKey: string): Promise<{ fireAt: number; title: string }[]> {
  const scheduled = await readScheduled();
  const now = Date.now();
  return Object.entries(scheduled)
    .filter(([id, e]) => id.startsWith(`duty:${unitKey}:`) && e.fireAt > now)
    .map(([, e]) => ({ fireAt: e.fireAt, title: e.title }))
    .sort((a, b) => a.fireAt - b.fireAt);
}

/** Restore the UI summary at launch without touching native alarms. */
export async function loadAlarmState(): Promise<void> {
  publish(await readScheduled());
}
