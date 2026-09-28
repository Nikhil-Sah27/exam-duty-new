import type { Notification, NotificationType } from "@/modules/notifications/types";
import { getDisplayContent } from "@/modules/notifications/utils/notificationHelpers";
import type {
  ImportantNotification,
  NotificationAccent,
  NotificationPriority,
} from "./types";

/**
 * Builds the "important popup" list for the operational (teacher) dashboards —
 * Invigilator, RS, DCS. Driven entirely by the per-user backend notification
 * feed, so the popup and the bell always agree on what happened. Only
 * "important" types surface, and only recent ones, so the popups stay
 * signal-not-noise. Each item carries a stable id (`notif-<_id>`) so the queue
 * (with localStorage persistence) shows it exactly once per user.
 */

export type OperationalRole = "invigilator" | "rs" | "dcs";

/** Only surface events fresh enough to still matter as a popup. */
const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
/** Cap the popups so a first login can't unleash a long parade. */
const MAX_POPUPS = 5;

type FeedAction = "duties" | "requests" | "exams";

interface FeedMeta {
  accent: NotificationAccent;
  priority: NotificationPriority;
  category: string;
  /** "very important" gold-highlight treatment. */
  highlight?: boolean;
  action?: FeedAction;
}

/**
 * Map each backend notification type → popup presentation. Types absent here
 * (e.g. `request_submitted`, which is CS-only) are never shown to teachers.
 */
const FEED_MAP: Partial<Record<NotificationType, FeedMeta>> = {
  // Very important + highlighted — a duty landed on the teacher's plate.
  duty_assigned: {
    accent: "violet",
    priority: "high",
    category: "Assigned by CS",
    highlight: true,
    action: "duties",
  },
  duty_group_assigned: {
    accent: "violet",
    priority: "high",
    category: "Assigned by CS",
    highlight: true,
    action: "duties",
  },
  duty_swapped: {
    accent: "violet",
    priority: "high",
    category: "Duty swapped to you",
    highlight: true,
    action: "duties",
  },
  // Very important — a duty the teacher held is gone.
  exam_deleted_duty_release: {
    accent: "red",
    priority: "high",
    category: "Exam cancelled",
    action: "duties",
  },
  duty_cancelled: {
    accent: "red",
    priority: "high",
    category: "Duty cancelled",
    action: "duties",
  },
  // Reminder — a duty is happening tomorrow.
  duty_reminder: {
    accent: "amber",
    priority: "high",
    category: "Duty tomorrow",
    action: "duties",
  },
  // Milestone — the teacher finished their whole target.
  target_reached: {
    accent: "green",
    priority: "medium",
    category: "Target complete",
    action: "duties",
  },
  // Important — change-request outcomes.
  request_approved: {
    accent: "blue",
    priority: "medium",
    category: "Request approved",
    action: "requests",
  },
  request_rejected: {
    accent: "amber",
    priority: "medium",
    category: "Request rejected",
    action: "requests",
  },
  // Informational but wanted — new exam open for selection / broadcast.
  exam_created: {
    accent: "blue",
    priority: "medium",
    category: "New exam",
    action: "exams",
  },
  announcement: {
    accent: "blue",
    priority: "medium",
    category: "Announcement",
  },
};

function actionLink(
  role: OperationalRole,
  action?: FeedAction,
): { actionLabel?: string; actionHref?: string } {
  if (!action) return {};
  const base = `/${role}`;
  switch (action) {
    case "duties":
      return { actionLabel: "View duties", actionHref: `${base}/upcoming-duties` };
    case "requests":
      return { actionLabel: "View requests", actionHref: `${base}/change-requests` };
    case "exams":
      return { actionLabel: "View exams", actionHref: `${base}/exams` };
    default:
      return {};
  }
}

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function buildRoleImportantNotifications(args: {
  role: OperationalRole;
  notifications: Notification[];
  now: number;
}): ImportantNotification[] {
  const { role, notifications, now } = args;

  return notifications
    .filter((n) => FEED_MAP[n.type])
    .filter((n) => now - new Date(n.createdAt).getTime() <= RECENT_WINDOW_MS)
    .slice(0, MAX_POPUPS) // feed arrives newest-first from the API
    .map((n) => {
      const meta = FEED_MAP[n.type] as FeedMeta;
      const { title, message } = getDisplayContent(n);
      return {
        id: `notif-${n._id}`,
        priority: meta.priority,
        accent: meta.accent,
        category: meta.category.toUpperCase(),
        title,
        message,
        highlight: meta.highlight,
        createdAt: n.createdAt,
        ...actionLink(role, meta.action),
      };
    })
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}
