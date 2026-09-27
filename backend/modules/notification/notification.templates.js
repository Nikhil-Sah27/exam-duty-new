// Centralized notification templates.
// Every notification type has its title and message defined here.
// To change wording, edit this file — no other module needs to change.

const formatDate = (date) => new Date(date).toLocaleDateString();

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatLongDate = (date) => {
  const d = new Date(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const formatTime12h = (hhmm) => {
  if (!hhmm || typeof hhmm !== "string") return "";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m.toString().padStart(2, "0");
  return `${hour12}:${mm} ${period}`;
};

const templates = {
  duty_assigned: ({ room, date, startTime, endTime }) => ({
    title: "New Duty Assigned",
    message: `You have been assigned duty at ${room} on ${formatDate(date)} (${startTime}–${endTime})`,
  }),

  duty_cancelled: ({ room, date }) => ({
    title: "Duty Cancelled",
    message: `Your duty at ${room} on ${formatDate(date)} has been cancelled`,
  }),

  request_submitted: ({ type, date }) => ({
    title: "New Change Request",
    message: `A ${type} request has been submitted for duty on ${formatDate(date)}`,
  }),

  request_approved: ({ type, reviewNote }) => ({
    title: "Request Approved",
    message: `Your ${type} request has been approved${reviewNote ? `: ${reviewNote}` : ""}`,
  }),

  request_rejected: ({ type, reviewNote }) => ({
    title: "Request Rejected",
    message: `Your ${type} request has been rejected${reviewNote ? `: ${reviewNote}` : ""}`,
  }),

  duty_swapped: () => ({
    title: "Duty Swap — You Have a New Duty",
    message: "A duty has been swapped to you. Check your duty list for details.",
  }),

  // Daily reminder for duties happening the next day. Aggregated per teacher —
  // `count` covers the case of multiple duties tomorrow.
  duty_reminder: ({ room, date, startTime, endTime, count }) => {
    if (count && count > 1) {
      return {
        title: "Duty Reminder — Tomorrow",
        message: `You have ${count} duties tomorrow, ${formatLongDate(date)}. First one at ${formatTime12h(startTime)}.`,
      };
    }
    const where = room ? ` · ${room}` : "";
    return {
      title: "Duty Reminder — Tomorrow",
      message: `You have a duty tomorrow, ${formatLongDate(date)} at ${formatTime12h(startTime)} – ${formatTime12h(endTime)}${where}.`,
    };
  },

  // Fired once a teacher completes their whole assigned-duty target.
  target_reached: ({ target }) => ({
    title: "Duty Target Reached 🎉",
    message: `You've completed all ${target} of your assigned duties. Great work!`,
  }),

  // Emitted once when CS/Admin publishes a new exam (group + schedules + rooms
  // all created). Sent to every duty-eligible teacher so they know new slots
  // are open for selection.
  exam_created: ({ examLabel, semester, startDate, endDate }) => {
    const range =
      startDate && endDate
        ? ` (${formatLongDate(startDate)} – ${formatLongDate(endDate)})`
        : "";
    const label =
      examLabel && semester != null
        ? `${examLabel} — Semester ${semester}`
        : examLabel || "A new exam";
    return {
      title: "New Exam Published",
      message: `${label} is now open for duty selection${range}.`,
    };
  },

  // Free-form broadcast sent by CS via the Notify module. `title` and
  // `message` are supplied verbatim by the sender (no interpolation).
  announcement: ({ title, message }) => ({
    title: title || "Announcement",
    message: message || "",
  }),

  // Emitted when CS/Admin deletes an exam (group/schedule/room) and the
  // teacher's duty is auto-released. Message includes the full slot context
  // so the recipient knows exactly which duty was cancelled.
  exam_deleted_duty_release: ({
    examLabel,
    semester,
    date,
    startTime,
    endTime,
    roomLabel,
  }) => {
    const lines = ["Your duty for:", ""];
    if (examLabel && semester != null) {
      lines.push(`${examLabel} — Semester ${semester}`);
    } else if (examLabel) {
      lines.push(examLabel);
    }
    if (date) lines.push(formatLongDate(date));
    if (startTime && endTime) {
      lines.push(`${formatTime12h(startTime)} – ${formatTime12h(endTime)}`);
    }
    if (roomLabel) lines.push(roomLabel);
    lines.push("");
    lines.push(
      "has been cancelled because the exam is no more available and was deleted by Controller/Admin."
    );
    return {
      title: "Duty Cancelled — Exam Deleted",
      message: lines.join("\n"),
    };
  },
};

module.exports = templates;
