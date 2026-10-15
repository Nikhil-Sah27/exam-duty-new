import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/** When an alarm rings, relative to duty start. "morning" = 7:00 AM on the duty day. */
export type LeadId = "morning" | "120" | "60" | "30" | "20" | "10";

export const LEAD_OPTIONS: { id: LeadId; label: string; minutes: number | null }[] = [
  { id: "morning", label: "Morning of duty · 7:00 AM", minutes: null },
  { id: "120", label: "2 hours before", minutes: 120 },
  { id: "60", label: "1 hour before", minutes: 60 },
  { id: "30", label: "30 minutes before", minutes: 30 },
  { id: "20", label: "20 minutes before", minutes: 20 },
  { id: "10", label: "10 minutes before", minutes: 10 },
];

export const MORNING_HOUR = 7;

export interface AlarmSettings {
  enabled: boolean;
  leads: LeadId[];
}

// Decided 2026-10-07 (MOBILE_PLAN.md §6): 1 h + 20 min. The server's own 30-min
// reminder push lands between them, so nothing rings twice at once.
export const DEFAULT_ALARM_SETTINGS: AlarmSettings = { enabled: true, leads: ["60", "20"] };

const KEY = "alarms.settings.v1";

/** Read straight from storage — usable outside React (sync engine, background handler). */
export async function loadAlarmSettings(): Promise<AlarmSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_ALARM_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AlarmSettings>;
    const valid = new Set(LEAD_OPTIONS.map((o) => o.id));
    return {
      enabled: parsed.enabled ?? DEFAULT_ALARM_SETTINGS.enabled,
      leads: Array.isArray(parsed.leads) ? parsed.leads.filter((l) => valid.has(l)) : DEFAULT_ALARM_SETTINGS.leads,
    };
  } catch {
    return DEFAULT_ALARM_SETTINGS;
  }
}

interface SettingsState {
  settings: AlarmSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AlarmSettings>) => Promise<AlarmSettings>;
}

export const useAlarmSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_ALARM_SETTINGS,
  loaded: false,
  load: async () => set({ settings: await loadAlarmSettings(), loaded: true }),
  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  },
}));
