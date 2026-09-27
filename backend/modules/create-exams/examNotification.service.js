// Fan-out notifications for exam lifecycle events in the create-exams flow.
// Kept separate from the create services so they only depend on the public
// notification emitter (never the notification repository/service directly).

const User = require("../auth/auth.model");
const { emitToMany } = require("../notification/notification.emitter");

// Roles that can hold exam duties — i.e. everyone who should hear that a new
// exam is open for selection. Pure-CS accounts are intentionally excluded.
const DUTY_ELIGIBLE_ROLES = ["invigilator", "rs", "dcs"];

/**
 * Notify every duty-eligible teacher that a freshly-published exam (group +
 * schedules + rooms) is now open for duty selection. Best-effort: callers wrap
 * this in try/catch so a notification hiccup never rolls back a created exam.
 */
const notifyExamPublished = async (examGroup) => {
  if (!examGroup) return;

  // The User pre-find hook already scopes to isActive: true.
  const teachers = await User.find({
    roles: { $in: DUTY_ELIGIBLE_ROLES },
  }).select("_id");

  if (teachers.length === 0) return;

  await emitToMany("exam_created", {
    recipients: teachers.map((t) => t._id),
    data: {
      examLabel: examGroup.examType,
      semester: examGroup.semester,
      startDate: examGroup.startDate,
      endDate: examGroup.endDate,
    },
  });
};

module.exports = { notifyExamPublished };
