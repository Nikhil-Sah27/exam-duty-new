import type { Duty } from "@/modules/duties/types";
import type { ImportantNotification } from "./types";
import type { OperationalRole } from "./roleNotificationSelectors";

/**
 * "You have a duty today" popup for the operational dashboards (Invigilator /
 * RS / DCS). Unlike the feed-driven popups this is computed live from the
 * viewer's own duties, so it re-appears on every refresh/login while the duty
 * is still today and not yet finished (see the PAGE_LOAD_NONCE note below).
 */

/**
 * Computed once per page load. Baking it into each notification id means the
 * ids never match the cross-session "seen" store from a previous load, so the
 * reminder shows again on every refresh/login — yet stays stable within a load
 * so the queue still shows it exactly once per visit.
 */
const PAGE_LOAD_NONCE = Date.now().toString(36);

const ROLE_LABEL: Record<OperationalRole, string> = {
  invigilator: "Invigilator",
  rs: "RS",
  dcs: "DCS",
};

function formatTime(t: string): string {
  const [h, m] = (t || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

/** True when the duty is on today's date and its end time hasn't passed. */
function isTodayNotPassed(duty: Duty, now: number): boolean {
  const d = new Date(duty.date);
  const today = new Date(now);
  if (
    d.getFullYear() !== today.getFullYear() ||
    d.getMonth() !== today.getMonth() ||
    d.getDate() !== today.getDate()
  ) {
    return false;
  }
  const [h, m] = (duty.endTime || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return true; // no end time → keep visible
  const endMin = h * 60 + m;
  const nowMin = today.getHours() * 60 + today.getMinutes();
  return endMin > nowMin;
}

function roomLabel(duty: Duty): string {
  const building = duty.examRoom?.room?.building?.name;
  const number = duty.examRoom?.room?.roomNumber ?? duty.room;
  return building ? `${building} — ${number}` : String(number ?? "");
}

/**
 * Build one "duty today" reminder per active duty scheduled for today whose
 * time hasn't passed. Returns an empty list when there's nothing today.
 */
export function buildDutyTodayNotifications(args: {
  role: OperationalRole;
  duties: Duty[];
  now: number;
}): ImportantNotification[] {
  const { role, duties, now } = args;

  return duties
    .filter((d) => d.status === "assigned")
    .filter((d) => isTodayNotPassed(d, now))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((d) => {
      const where = roomLabel(d);
      return {
        id: `duty-today-${d._id}-${PAGE_LOAD_NONCE}`,
        priority: "high" as const,
        accent: "amber" as const,
        category: "TODAY'S DUTY",
        title: "You have a duty today",
        message: `${ROLE_LABEL[role]} duty today at ${formatTime(d.startTime)} – ${formatTime(
          d.endTime,
        )}${where ? ` · ${where}` : ""}.`,
        highlight: true,
        actionLabel: "View duties",
        actionHref: `/${role}/upcoming-duties`,
        createdAt: new Date(now).toISOString(),
      };
    });
}
