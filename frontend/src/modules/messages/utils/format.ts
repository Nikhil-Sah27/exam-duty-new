/** Quick-reaction set shown in the message action menu. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** A compact palette for the composer's emoji picker. */
export const EMOJI_PALETTE = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤔", "😐", "😴", "😅", "😇", "🙂", "😉", "😌",
  "👍", "👎", "👏", "🙏", "💪", "🙌", "🤝", "✌️",
  "❤️", "🔥", "🎉", "✅", "❌", "⚠️", "❓", "❗",
  "😢", "😭", "😡", "😱", "😤", "🥳", "🤗", "😬",
  "📌", "📝", "📅", "⏰", "📢", "💯", "👀", "🙋",
];

/** Compact chat timestamp: time only for today, else "12 Oct 14:05". */
export function formatMessageTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (d.toDateString() === new Date().toDateString()) return time;
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return `${date} ${time}`;
}

/** Day divider label: "Today" / "Yesterday" / "12 October 2026". */
export function formatDayDivider(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** True when two messages fall on different calendar days. */
export function isNewDay(
  prev: string | null | undefined,
  curr: string | null | undefined,
): boolean {
  if (!curr) return false;
  if (!prev) return true;
  return new Date(prev).toDateString() !== new Date(curr).toDateString();
}

/** Up-to-two-letter initials from a name, for avatar chips. */
export function initials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
