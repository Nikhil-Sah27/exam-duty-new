import type { ImportantNotification } from "./types";
import type { OperationalRole } from "./roleNotificationSelectors";

/**
 * "You have messages from the CS" popup for the operational dashboards
 * (Invigilator / RS / DCS). Like the "duty today" reminder, the id folds in a
 * per-page-load nonce so the cross-session "seen" store never matches a previous
 * load — the reminder re-appears on every refresh / login while unread remains,
 * yet stays stable within a load so the queue shows it exactly once per visit.
 */
const PAGE_LOAD_NONCE = Date.now().toString(36);

export function buildUnreadCsMessagesNotification(args: {
  role: OperationalRole;
  unread: number;
}): ImportantNotification[] {
  const { role, unread } = args;
  if (!unread || unread <= 0) return [];
  return [
    {
      id: `unread-cs-messages-${PAGE_LOAD_NONCE}`,
      priority: "high",
      accent: "violet",
      category: "NEW MESSAGE",
      title: unread === 1 ? "Message from CS" : "Messages from CS",
      message: `You have ${unread} unread message${
        unread !== 1 ? "s" : ""
      } from the Controller (CS).`,
      highlight: true,
      actionLabel: "Open messages",
      actionHref: `/${role}/messages`,
    },
  ];
}
