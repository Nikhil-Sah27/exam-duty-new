// Centralized notification templates.
// Every notification type has its title and message defined here.
// To change wording, edit this file — no other module needs to change.
//
// Date/time formatters live in shared/utils/datetime.js because the email
// templates (modules/mail/mail.templates.js) render the same values and the two
// channels must not drift apart.

const {
  formatDate,
  formatLongDate,
  formatTime12h,
} = require("../../shared/utils/datetime");

const templates = {
  duty_assigned: ({ room, date, startTime, endTime }) => ({
    title: "New Duty Assigned",
    message: `You have been assigned duty at ${room} on ${formatDate(date)} (${startTime}–${endTime})`,
  }),

  // A whole room group (RS / DCS) assigned in one go. Fires ONCE per group —
  // never per room — so a 5-room group is a single bell entry, not five.
  duty_group_assigned: ({
    roleLabel,
    roomCount,
    date,
    startTime,
    endTime,
    examLabel,
    semester,
  }) => {
    const scope =
      examLabel && semester != null
        ? `${examLabel} — Semester ${semester}: `
        : examLabel
          ? `${examLabel}: `
          : "";
    const rooms = `${roomCount} room${roomCount === 1 ? "" : "s"}`;
    const article = roleLabel === "RS" ? "an" : "a";
    return {
      title: "New Duty Assigned",
      message: `${scope}You've been assigned ${article} ${roleLabel} group of ${rooms} on ${formatDate(
        date
      )} (${startTime}–${endTime}).`,
    };
  },

  // Confirmation to a teacher who picked a duty themselves. Self-claim used to
  // notify nobody at all, which meant a teacher had no record of what they'd
  // committed to outside the app — and nothing to email them.
  duty_self_claimed: ({ room, date, startTime, endTime, roleLabel, roomCount }) => {
    const isGroup = roomCount != null && roomCount > 1;
    const article = roleLabel === "RS" ? "an" : "a";
    const what = isGroup
      ? `${article} ${roleLabel} group of ${roomCount} rooms`
      : `a duty at ${room}`;
    return {
      title: "Duty Confirmed",
      message: `You selected ${what} on ${formatLongDate(date)} (${formatTime12h(
        startTime
      )} – ${formatTime12h(endTime)}). It's now on your upcoming duties.`,
    };
  },

  // ── CS-facing awareness alerts ──────────────────────────────────────────
  // CS had no feed of teacher-initiated changes: a self-claim or a release only
  // showed up by opening Manage Duties and noticing the difference.

  duty_claimed_by_teacher: ({ teacherName, roleLabel, room, date, roomCount }) => {
    const article = roleLabel === "RS" ? "an" : "a";
    const what =
      roomCount != null && roomCount > 1
        ? `${article} ${roleLabel} group of ${roomCount} rooms`
        : `${room}`;
    return {
      title: "Duty Claimed",
      message: `${teacherName} selected ${what} on ${formatLongDate(date)}.`,
    };
  },

  duty_released_by_teacher: ({ teacherName, room, date, reason }) => ({
    title: "Duty Released",
    message: `${teacherName} released their duty at ${room} on ${formatLongDate(
      date
    )}${reason ? ` — ${reason}` : ""}. The room is now vacant.`,
  }),

  group_released: ({ teacherName, roleLabel, roomCount, date, reason }) => ({
    title: `${roleLabel} Group Released`,
    message: `${teacherName} released ${roleLabel === "RS" ? "an" : "a"} ${roleLabel} group of ${roomCount} room${
      roomCount === 1 ? "" : "s"
    } on ${formatLongDate(date)}${reason ? ` — ${reason}` : ""}. It is open again.`,
  }),

  // Sent to everyone holding a duty under an exam group whose details changed.
  // Only duty-relevant edits trigger it (see examGroup.service.updateGroup) —
  // a cosmetic rename shouldn't page every invigilator.
  exam_updated: ({ examLabel, semester, changes }) => {
    const label =
      examLabel && semester != null
        ? `${examLabel} — Semester ${semester}`
        : examLabel || "An exam you have a duty for";
    const what = changes && changes.length > 0 ? ` (${changes.join(", ")})` : "";
    return {
      title: "Exam Details Changed",
      message: `${label} has been updated${what}. Please re-check your duty details.`,
    };
  },

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

  // Reminder for an upcoming duty, generated the day before by the daily sweep.
  // The message is anchored to the ABSOLUTE date (never "tomorrow"): a stored
  // notification is read later than it's created, so relative wording goes stale
  // the moment the day rolls over ("tomorrow" while the duty is actually today).
  duty_reminder: ({ room, date, startTime, endTime, count }) => {
    if (count && count > 1) {
      return {
        title: "Upcoming Duty Reminder",
        message: `You have ${count} duties on ${formatLongDate(date)}. First one at ${formatTime12h(startTime)}.`,
      };
    }
    const where = room ? ` · ${room}` : "";
    return {
      title: "Upcoming Duty Reminder",
      message: `You have a duty on ${formatLongDate(date)} at ${formatTime12h(startTime)} – ${formatTime12h(endTime)}${where}.`,
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
