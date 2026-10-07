import type { DutyUnit } from "@/lib/types";
import { examTitle, formatClock } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";

import { LEAD_OPTIONS, MORNING_HOUR, type AlarmSettings, type LeadId } from "./settings";

/** Everything needed to ring one alarm — also what travels in the notification's data. */
export interface AlarmPayload {
  id: string;
  fireAt: number;
  title: string;
  body: string;
  /** ≤15 chars — AlarmKit's title (shown in the Dynamic Island). */
  shortTitle: string;
  unitKey: string;
  primaryDutyId: string;
  startsAt: string;
  lead: LeadId | "snooze" | "test";
  test?: boolean;
}

export interface PlannedAlarm extends AlarmPayload {
  /** Changes when anything shown in the alarm changes → it gets rescheduled. */
  fingerprint: string;
}

const MIN = 60_000;
const MIN_GAP = 10 * MIN; // two alarms for one unit closer than this collapse into one
const MAX_ALARMS = 40; // iOS keeps at most 64 pending local notifications per app

const leadTitle = (lead: LeadId): string => {
  if (lead === "morning") return "Exam duty today";
  const minutes = Number(lead);
  return minutes >= 60 ? `Exam duty in ${minutes / 60} hour${minutes > 60 ? "s" : ""}` : `Exam duty in ${minutes} minutes`;
};

export function alarmBody(unit: DutyUnit): string {
  return `${ROLE_LABELS[unit.role]} · ${examTitle(unit.examLabel, unit.semester)} · ${formatClock(unit.startTime)} · ${unit.location}`;
}

function fireTimeFor(unit: DutyUnit, lead: LeadId): number {
  const start = new Date(unit.startsAt).getTime();
  const option = LEAD_OPTIONS.find((o) => o.id === lead);
  if (option?.minutes != null) return start - option.minutes * MIN;
  // Morning: 7:00 on the duty's day in the phone's clock (the institution's
  // timezone for everyone this app serves).
  const d = new Date(start);
  d.setHours(MORNING_HOUR, 0, 0, 0);
  return d.getTime();
}

/** The alarms that SHOULD exist right now for these units and settings. */
export function planAlarms(units: DutyUnit[], settings: AlarmSettings, now = Date.now()): PlannedAlarm[] {
  if (!settings.enabled || settings.leads.length === 0) return [];
  const planned: PlannedAlarm[] = [];

  for (const unit of units) {
    const start = new Date(unit.startsAt).getTime();
    if (!Number.isFinite(start) || start <= now) continue;
    const fingerprint = [unit.startsAt, unit.location, unit.role, unit.examLabel, unit.semester ?? ""].join("|");

    const candidates = settings.leads
      .map((lead) => ({ lead, fireAt: fireTimeFor(unit, lead) }))
      .filter((c) => c.fireAt > now + 5_000 && c.fireAt < start)
      .sort((a, b) => a.fireAt - b.fireAt);

    let lastKept = -Infinity;
    for (const { lead, fireAt } of candidates) {
      if (fireAt - lastKept < MIN_GAP) continue;
      lastKept = fireAt;
      planned.push({
        id: `duty:${unit.key}:${lead}`,
        fireAt,
        title: leadTitle(lead),
        body: alarmBody(unit),
        shortTitle: `Duty ${formatClock(unit.startTime)}`.slice(0, 15),
        unitKey: unit.key,
        primaryDutyId: unit.primaryDutyId,
        startsAt: unit.startsAt,
        lead,
        fingerprint: `${fingerprint}|${lead}`,
      });
    }
  }

  return planned.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAX_ALARMS);
}

/** Flatten a payload into the string-only map notification `data` fields accept. */
export function toAlarmData(p: AlarmPayload): Record<string, string> {
  return {
    kind: "duty-alarm",
    id: p.id,
    fireAt: String(p.fireAt),
    title: p.title,
    body: p.body,
    shortTitle: p.shortTitle,
    unitKey: p.unitKey,
    primaryDutyId: p.primaryDutyId,
    startsAt: p.startsAt,
    lead: p.lead,
    test: p.test ? "1" : "0",
  };
}

export function fromAlarmData(data: Record<string, unknown> | undefined | null): AlarmPayload | null {
  if (!data || data.kind !== "duty-alarm") return null;
  const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
  return {
    id: s("id"),
    fireAt: Number(s("fireAt")) || Date.now(),
    title: s("title"),
    body: s("body"),
    shortTitle: s("shortTitle"),
    unitKey: s("unitKey"),
    primaryDutyId: s("primaryDutyId"),
    startsAt: s("startsAt"),
    lead: (s("lead") || "test") as AlarmPayload["lead"],
    test: s("test") === "1",
  };
}
