/**
 * Single source of truth for the upcoming/completed split.
 *
 * A duty (or group/slot) is "upcoming" when its date is in the future, OR it's
 * today but its END time hasn't passed yet. Once the end time is in the past it
 * counts as completed — so a duty that finished earlier today drops out of the
 * upcoming lists and shows under Completed instead.
 *
 * Used by the dashboards, the invigilator/RS/DCS Upcoming Duties pages, and the
 * dashboard normalizers so every surface agrees on what's still upcoming.
 */
export function isDutyUpcoming(
  dateStr: string | Date,
  endTime: string,
): boolean {
  const day = new Date(dateStr);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (day > today) return true;
  if (day < today) return false;

  // Same day — upcoming only while the end time is still ahead of now.
  const [h, m] = (endTime || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return true; // no end time → keep visible
  const endMin = h * 60 + m;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return endMin > nowMin;
}
