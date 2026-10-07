// Display helpers. Exam dates are calendar days stored as UTC midnight and times
// are local wall-clock strings ("09:30") in the institution's timezone, so
// format them from their parts — never through the device timezone.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "09:30" → "9:30 AM" */
export function formatClock(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

/** Exam calendar date (UTC midnight ISO) → "Mon, 12 Oct" */
export function formatExamDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** A real instant shown in the device's own clock → "Mon 12 Oct, 8:30 AM" */
export function formatInstant(ms: number | Date): string {
  const d = typeof ms === "number" ? new Date(ms) : ms;
  const h = d.getHours();
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${time}`;
}

/** Same calendar day in the device clock? */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today" / "Tomorrow" / "Mon, 12 Oct" for an exam date. */
export function relativeExamDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((d.getTime() - todayUtc) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return formatExamDate(iso);
}

/** "3 min ago", "2 h ago", "5 Oct" for notification timestamps. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} d ago`;
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Exam label line used on cards: "SEE · Sem 5" */
export function examTitle(examLabel: string, semester: number | null): string {
  return `${examLabel}${semester ? ` · Sem ${semester}` : ""}`;
}
