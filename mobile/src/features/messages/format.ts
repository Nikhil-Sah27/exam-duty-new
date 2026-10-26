// Chat display helpers, ported from frontend/src/modules/messages/utils/format.ts.
// Message times are real instants, so they're shown in the device's own clock.

import type { ChatMessage, NamedRef } from "./api";

/** Quick-reaction set shown in the message action sheet (same as the web). */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** The composer's emoji palette (same set and order as the web). */
export const EMOJI_PALETTE = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤔", "😐", "😴", "😅", "😇", "🙂", "😉", "😌",
  "👍", "👎", "👏", "🙏", "💪", "🙌", "🤝", "✌️",
  "❤️", "🔥", "🎉", "✅", "❌", "⚠️", "❓", "❗",
  "😢", "😭", "😡", "😱", "😤", "🥳", "🤗", "😬",
  "📌", "📝", "📅", "⏰", "📢", "💯", "👀", "🙋",
];

/** Matches the backend's limit (message.service cleanBody). */
export const MAX_MESSAGE_LENGTH = 4000;

export const CS_LABEL = "Controller (CS)";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const clock = (d: Date) => {
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Compact bubble timestamp: time only for today, else "12 Oct, 2:05 PM". */
export function formatMessageTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (sameDay(d, new Date())) return clock(d);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${clock(d)}`;
}

/** Day divider label: "Today" / "Yesterday" / "12 October 2026". */
export function formatDayDivider(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** True when two messages fall on different calendar days (device clock). */
export function isNewDay(prev: string | null | undefined, curr: string | null | undefined): boolean {
  if (!curr) return false;
  if (!prev) return true;
  return !sameDay(new Date(prev), new Date(curr));
}

export const refId = (ref: NamedRef | string | undefined | null): string | null =>
  ref == null ? null : typeof ref === "object" ? ref._id : ref;

export const refName = (ref: NamedRef | string | undefined | null): string | undefined =>
  ref && typeof ref === "object" ? ref.name : undefined;

/** Up-to-two-letter initials from a name, for avatar chips (web `initials`). */
export function initials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Who a message (or a reply preview) is from, as the web labels it. */
export function senderLabel(m: Pick<ChatMessage, "senderIsCs"> & { sender?: NamedRef | string }): string {
  if (m.senderIsCs) return CS_LABEL;
  return refName(m.sender) ?? "Teacher";
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

/** Aggregate raw reactions into { emoji, count, mine } chips (web summarizeReactions). */
export function summarizeReactions(message: ChatMessage, myUserId: string | null): ReactionSummary[] {
  const map = new Map<string, ReactionSummary>();
  for (const r of message.reactions ?? []) {
    const cur = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    cur.count += 1;
    if (myUserId && refId(r.user) === myUserId) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return [...map.values()];
}

/** The viewer's own reaction on a message, if any (one per user). */
export function myReaction(message: ChatMessage, myUserId: string | null): string | null {
  if (!myUserId) return null;
  return (message.reactions ?? []).find((r) => refId(r.user) === myUserId)?.emoji ?? null;
}
