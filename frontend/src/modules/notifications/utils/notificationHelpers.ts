import type { Notification, NotificationType } from "../types";

/**
 * Notification-presentation helpers. Live in one place so item/list/modal
 * components can share them without each reaching into their own ad-hoc
 * formatters.
 */

/** "just now" | "5m ago" | "2h ago" | "3d ago" */
export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Per-type visual metadata for the bell list. `tone` drives the left accent
 * bar / dot colour; `highlight` gives the "very important" types (a duty
 * assigned by CS, a swap landing on you) a standout amber treatment.
 */
type NotifTone = "red" | "amber" | "blue" | "violet" | "green" | "slate";

interface NotifTypeMeta {
  tone: NotifTone;
  highlight: boolean;
}

const TYPE_META: Record<NotificationType, NotifTypeMeta> = {
  duty_assigned: { tone: "violet", highlight: true },
  duty_group_assigned: { tone: "violet", highlight: true },
  duty_swapped: { tone: "violet", highlight: true },
  // The teacher chose this one, so it confirms rather than demands attention.
  duty_self_claimed: { tone: "green", highlight: false },
  // Teachers must re-check a duty whose exam moved under them.
  exam_updated: { tone: "amber", highlight: true },
  exam_deleted_duty_release: { tone: "red", highlight: false },
  duty_cancelled: { tone: "red", highlight: false },
  duty_group_cancelled: { tone: "red", highlight: false },
  duty_reminder: { tone: "amber", highlight: false },
  target_reached: { tone: "green", highlight: false },
  request_approved: { tone: "blue", highlight: false },
  request_rejected: { tone: "amber", highlight: false },
  request_submitted: { tone: "blue", highlight: false },
  exam_created: { tone: "blue", highlight: false },
  announcement: { tone: "blue", highlight: false },
  // CS-facing: a claim is informational, a release leaves a room to re-fill.
  duty_claimed_by_teacher: { tone: "blue", highlight: false },
  duty_released_by_teacher: { tone: "amber", highlight: false },
  group_released: { tone: "amber", highlight: false },
};

const TONE_BORDER: Record<NotifTone, string> = {
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  blue: "border-l-blue-500",
  violet: "border-l-violet-500",
  green: "border-l-emerald-500",
  slate: "border-l-slate-400",
};

const TONE_DOT: Record<NotifTone, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  green: "bg-emerald-500",
  slate: "bg-slate-400",
};

/**
 * Presentation title/message for a notification. Broadcasts (`announcement`)
 * are always sent by CS, but stored with the CS-typed subject as the title and
 * no sender attribution — so we relabel them "Announcement from CS" and fold
 * the original subject into the message. Applied at render time, so it fixes
 * already-stored announcements too. All other types render verbatim.
 */
export function getDisplayContent(n: {
  type: NotificationType;
  title: string;
  message: string;
}): { title: string; message: string } {
  if (n.type === "announcement") {
    const subject = (n.title || "").trim();
    return {
      title: "Announcement from CS",
      message: subject ? `${subject} — ${n.message}` : n.message,
    };
  }
  return { title: n.title, message: n.message };
}

export function getNotificationMeta(type: NotificationType): {
  tone: NotifTone;
  highlight: boolean;
  border: string;
  dot: string;
} {
  const meta = TYPE_META[type] ?? { tone: "slate", highlight: false };
  return {
    ...meta,
    border: TONE_BORDER[meta.tone],
    dot: TONE_DOT[meta.tone],
  };
}

/**
 * Defensive ownership check. The backend already enforces this; this is a
 * UI-side guard so a wrongly-cached notification from another user can never
 * trigger a delete call against the server.
 */
export function isOwnNotification(
  notification: Notification,
  userId: string | undefined,
): boolean {
  if (!userId) return false;
  return String(notification.recipient) === String(userId);
}
