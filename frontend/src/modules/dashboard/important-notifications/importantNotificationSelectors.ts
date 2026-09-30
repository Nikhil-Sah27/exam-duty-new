/**
 * Centralized, pure builders for the CS dashboard's important notifications.
 * Each builder consumes data the dashboard already fetches (assignment target,
 * change requests) — there is NO parallel data store here. `getImportant\
 * DashboardNotifications` combines, de-dupes and priority-sorts them.
 */
import type { DashboardAssignmentTarget } from "@/modules/shared/exams/selectors/dashboardSelectors";
import type { ChangeRequest } from "@/modules/shared/change-requests/types/changeRequest.types";
import type { ImportantNotification, NotificationPriority } from "./types";

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Local `YYYY-MM-DD` key for a Date (stable id fragment). */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Duty change requests awaiting CS review. Aggregated into a single popup
 * (one when a single request, a summary when several) so a login never
 * bombards the CS with one popup per request. The id folds in the count +
 * latest request id, so it re-surfaces when the pending set changes.
 */
export function getDutyChangeNotifications(
  requests: ChangeRequest[],
): ImportantNotification[] {
  const pending = requests.filter((r) => r.status === "pending");
  if (pending.length === 0) return [];

  const sorted = [...pending].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latest = sorted[0];
  const count = pending.length;

  let message: string;
  if (count === 1) {
    const who = latest.requestedBy?.name ?? "A teacher";
    const examName = latest.duty?.exam?.name;
    message = `${who} requested a change to their upcoming duty${
      examName ? ` for ${examName}` : ""
    }.`;
  } else {
    message = `${count} teachers have requested changes to their duties.`;
  }

  return [
    {
      id: `duty-change-${count}-${latest._id}`,
      priority: "high",
      accent: "amber",
      category: "DUTY REQUEST",
      title: count === 1 ? "Duty Change Request" : "Duty Change Requests",
      message,
      actionLabel: "Review requests",
      actionHref: "/requests",
      createdAt: latest.createdAt,
    },
  ];
}

/** Reminder that exams are scheduled tomorrow (uses the shared target). */
export function getTomorrowExamNotification(
  target: DashboardAssignmentTarget,
): ImportantNotification | null {
  if (!target.date || !target.isTomorrow || target.exams.length === 0) {
    return null;
  }
  const examCount = target.exams.length;
  return {
    id: `tomorrow-exam-${dateKey(target.date)}`,
    priority: "medium",
    accent: "blue",
    category: "EXAM REMINDER",
    title: "Tomorrow's Exams",
    message: `${examCount} exam${examCount !== 1 ? "s" : ""} scheduled for tomorrow.`,
    actionLabel: "View exams",
    actionHref: "/exams",
  };
}

/**
 * Alert that the next exam date has classes still needing teacher assignment.
 * Uses the SAME `notAssigned` / `partiallyAssigned` figures as the dashboard
 * cards — no duplicated assignment logic.
 */
export function getAssignmentAlertNotification(
  target: DashboardAssignmentTarget,
): ImportantNotification | null {
  if (!target.date) return null;
  const total = target.notAssigned + target.partiallyAssigned;
  if (total <= 0) return null;
  return {
    id: `assignment-alert-${dateKey(target.date)}-${target.notAssigned}-${target.partiallyAssigned}`,
    priority: "medium",
    accent: "amber",
    category: "ASSIGNMENT ALERT",
    title: "Teacher Assignment Alert",
    message: `${total} class${total !== 1 ? "es" : ""} for the next exams ${
      total !== 1 ? "are" : "is"
    } not fully assigned.`,
    // No CTA on this one — informational only (per CS request).
  };
}

/**
 * Exam cancellation notifications. The app hard-deletes exam groups and only
 * records `exam_deleted_duty_release` events for affected teachers (not CS),
 * so there is no existing CS-facing cancellation feed to consume. Returns an
 * empty list — the type stays fully wired so a future event source drops in
 * here without touching the queue or UI. (No fabricated cancellation store.)
 */
export function getExamCancellationNotifications(): ImportantNotification[] {
  return [];
}

/**
 * Unread direct messages from teachers. A single aggregated popup with the
 * count. The id is intentionally STABLE (not count-based) so it surfaces once
 * per page load / login and does NOT re-pop when more messages arrive mid-
 * session — per the CS request, it should only appear on refresh or sign-in.
 */
export function getUnreadMessagesNotification(
  unreadMessages: number,
): ImportantNotification | null {
  if (!unreadMessages || unreadMessages <= 0) return null;
  return {
    id: "unread-messages",
    priority: "medium",
    accent: "violet",
    category: "MESSAGES",
    title: unreadMessages === 1 ? "New Message" : "New Messages",
    message: `You have ${unreadMessages} unread message${
      unreadMessages !== 1 ? "s" : ""
    } from teachers.`,
    actionLabel: "Open messages",
    actionHref: "/messages",
  };
}

interface BuildInput {
  assignmentTarget: DashboardAssignmentTarget;
  changeRequests: ChangeRequest[];
  unreadMessages: number;
}

/**
 * The single composition point the dashboard consumes: gathers every builder's
 * output, de-dupes by id, and sorts by priority (high → medium → low),
 * preserving insertion order within a priority.
 */
export function getImportantDashboardNotifications({
  assignmentTarget,
  changeRequests,
  unreadMessages,
}: BuildInput): ImportantNotification[] {
  const collected: ImportantNotification[] = [
    ...getExamCancellationNotifications(),
    ...getDutyChangeNotifications(changeRequests),
  ];
  const messages = getUnreadMessagesNotification(unreadMessages);
  if (messages) collected.push(messages);
  const tomorrow = getTomorrowExamNotification(assignmentTarget);
  if (tomorrow) collected.push(tomorrow);
  const alert = getAssignmentAlertNotification(assignmentTarget);
  if (alert) collected.push(alert);

  const seen = new Set<string>();
  const unique = collected.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  return unique
    .map((n, i) => ({ n, i }))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.n.priority] - PRIORITY_RANK[b.n.priority] || a.i - b.i,
    )
    .map(({ n }) => n);
}
