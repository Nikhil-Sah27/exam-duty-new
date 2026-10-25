// Centralized, transaction-safe cascade for "delete an exam (or any of its
// substructure) and release everything that depended on it". This is the
// ONLY place that should be wiring together: schedule/room deletion, duty
// release, change-request cancellation, audit logging, and notifications.
// Existing controllers delegate here so nobody can accidentally bypass the
// cascade by calling the underlying repositories directly.

const AppError = require("../../../shared/utils/AppError");
const { withOptionalTransaction } = require("../../../shared/utils/withOptionalTransaction");

const examRepository = require("../../exam/exam.repository");
const examGroupRepository = require("../../exam/examGroup.repository");
const examScheduleRepository = require("../../exam/examSchedule.repository");
const examRoomRepository = require("../../exam/examRoom.repository");

const ExamGroup = require("../../exam/examGroup.model");
const ExamSchedule = require("../../exam/examSchedule.model");
const ExamRoom = require("../../exam/examRoom.model");
const Exam = require("../../exam/exam.model");
const dcsGroupRepository = require("../../dcs/dcsGroup.repository");
const dcsGroupService = require("../../dcs/dcsGroup.service");
const dutyService = require("../../duty/duty.service");

const { releaseDuties } = require("./dutyReleaseService");
const { notifyReleasedDuties } = require("./notificationCleanupService");
const { cancelRequestsForDuties } = require("./changeRequestCleanupService");

const auditService = require("../../audit/audit.service");
const seatSharingService = require("../../seat-sharing/seatSharing.service");

const {
  getCascadeScopeForGroup,
  getCascadeScopeForSchedule,
  getCascadeScopeForExamRoom,
  getCascadeScopeForExam,
} = require("../utils/scheduleReleaseUtils");
const { buildRoomLabel } = require("../utils/examCleanupUtils");

// The leaving group's shared slots stay for the departments still in them
// (examScheduleRepository.leaveShared); when it owned one, the slot's DCS
// groups follow the slot to its new owner. Its own rooms are deleted by the
// cascade like any other.
const leaveSharedSchedules = async (groupId, sharedSchedules, session) => {
  for (const s of sharedSchedules) {
    const newOwner = await examScheduleRepository.leaveShared(s, groupId, session);
    if (newOwner) await dcsGroupRepository.reassignExamGroupForSchedules([s._id], newOwner, session);
  }
};

const summarizeCascade = (duties) => {
  // First-seen wins for the teacher's display name + role.
  const teacherById = new Map();
  for (const d of duties) {
    const tid = d.teacher?._id || d.teacher;
    if (!tid) continue;
    const key = tid.toString();
    if (teacherById.has(key)) continue;
    teacherById.set(key, {
      teacherId: tid,
      name: d.teacher?.name || null,
      // The role slot this duty filled — unambiguous even when the teacher
      // holds multiple roles (rs + invigilator).
      role: d.role || null,
    });
  }
  const affectedTeachers = [...teacherById.values()];

  const affectedRooms = [...new Set(duties.map(buildRoomLabel).filter(Boolean))];

  const affectedDates = [
    ...new Set(
      duties
        .map((d) => (d.date ? new Date(d.date).toISOString() : null))
        .filter(Boolean),
    ),
  ];

  return {
    affectedTeachers,
    affectedRooms,
    affectedDates,
    releasedDutyIds: duties.map((d) => d._id),
  };
};

const runCascade = async ({
  scope,
  entity,
  entityId,
  actorId,
  ipAddress,
  finalize, // (session) => Promise — runs after release/notify, inside the txn
  details = {},
  // Released duties that get the per-duty "exam deleted" notice. Defaults to all.
  notifyDuties = scope.duties,
}) => {
  return withOptionalTransaction(async (session) => {
    const dutyIds = scope.duties.map((d) => d._id);

    const release = await releaseDuties(dutyIds, { session });

    const requests = await cancelRequestsForDuties(dutyIds, {
      session,
      actorId,
    });

    // Notifications go inside the transaction — if they fail, the entire
    // cascade rolls back. Per the spec: never leave partial state.
    await notifyReleasedDuties(notifyDuties, { session });

    // Finalize: actual deletion of the entity (and its substructure).
    // This runs after release/notify so foreign-key-ish references stay
    // resolvable while we build notification messages.
    await finalize(session);

    const summary = summarizeCascade(scope.duties);

    await auditService.log(
      {
        action: "DELETE_EXAM",
        entity,
        entityId,
        performedBy: actorId,
        ipAddress,
        details: {
          ...details,
          ...summary,
          releasedDutyCount: release.modifiedCount,
          cancelledChangeRequestIds: requests.cancelledIds,
          cancelledChangeRequestCount: requests.modifiedCount,
        },
      },
      session,
    );

    return summary;
  });
};

// ──────────────────────────────────────────────────────────────
// Public entry points — one per deletion-scope kind. Each accepts
// `{ actorId, ipAddress }` so audit logs always know who did it.
// ──────────────────────────────────────────────────────────────

const deleteExamGroupWithCleanup = async (
  groupId,
  { actorId, ipAddress } = {},
) => {
  if (!actorId) throw new AppError("Actor (user) is required for deletion", 400);

  const group = await examGroupRepository.findById(groupId);
  if (!group) throw new AppError("Exam group not found", 404);

  const scope = await getCascadeScopeForGroup(groupId);

  // RS/DCS holders in a shared slot that survives keep their group, minus this
  // department's rooms; the regrouping below tells them exactly what changed,
  // instead of a per-room "duty cancelled" for a duty they still mostly hold.
  const sharedIds = new Set(scope.sharedSchedules.map((s) => String(s._id)));
  const onSurvivingGroup = (d) =>
    (d.role === "rs" || d.role === "dcs") &&
    sharedIds.has(String(d.examSchedule?._id || d.examSchedule));

  const summary = await runCascade({
    scope,
    notifyDuties: scope.duties.filter((d) => !onSurvivingGroup(d)),
    entity: "ExamGroup",
    entityId: groupId,
    actorId,
    ipAddress,
    details: {
      scope: "exam_group",
      examGroupLabel: `${group.examType} — Sem ${group.semester}`,
      affectedSchedules: scope.scheduleIds,
      affectedExamRooms: scope.examRoomIds,
    },
    finalize: async (session) => {
      // Seat-sharing cascade: run BEFORE ExamRoom.deleteMany so we can
      // (a) restore seats to source configs the deleted group borrowed from,
      // and (b) delete configs this group owned (plus their dependent
      // consumer allocations, which will no longer have a source room).
      await seatSharingService.releaseAllocationsByConsumerGroup({
        consumerExamGroupId: groupId,
        session,
      });
      await seatSharingService.releaseAllocationsBySourceGroup({
        sourceExamGroupId: groupId,
        session,
      });

      // Shared SEE slots outlive this department: hand them over first, so the
      // DCS groups that follow the slot survive the delete below.
      await leaveSharedSchedules(groupId, scope.sharedSchedules, session);

      // DCS groups belong to the exam-group lifecycle — drop them alongside
      // schedules/rooms. Any duties they generated were already released by
      // the cascade above via the Duty refs in scope.duties.
      await dcsGroupRepository.deleteByExamGroups([groupId], session);
      if (scope.examRoomIds.length > 0) {
        await ExamRoom.deleteMany(
          { _id: { $in: scope.examRoomIds } },
          session ? { session } : {},
        );
      }
      if (scope.scheduleIds.length > 0) {
        await ExamSchedule.deleteMany(
          { _id: { $in: scope.scheduleIds } },
          session ? { session } : {},
        );
      }
      // Soft-delete the group itself (existing convention).
      await ExamGroup.findByIdAndUpdate(
        groupId,
        { isActive: false },
        session ? { session } : {},
      );
    },
  });

  // Post-commit, like exam creation: the departments left in each shared slot
  // get their DCS and RS groups re-formed without this department's rooms, and
  // every holder is told what was removed (or added). Failure-isolated — the
  // delete itself already succeeded.
  for (const s of scope.sharedSchedules) {
    try {
      await dcsGroupService.syncGroupsForSchedule(s._id, { cause: "leave" });
    } catch (err) {
      console.error("DCS group sizing failed for schedule", s._id, err);
    }
    try {
      await dutyService.syncRsGroupsForSchedule(s._id, {
        cause: "leave",
        removedDuties: scope.duties.filter(
          (d) => d.role === "rs" && String(d.examSchedule?._id || d.examSchedule) === String(s._id),
        ),
      });
    } catch (err) {
      console.error("RS regrouping failed for schedule", s._id, err);
    }
  }

  return summary;
};

const deleteScheduleWithCleanup = async (
  scheduleId,
  { actorId, ipAddress } = {},
) => {
  if (!actorId) throw new AppError("Actor (user) is required for deletion", 400);

  const schedule = await examScheduleRepository.findById(scheduleId);
  if (!schedule) throw new AppError("Schedule not found", 404);

  const scope = await getCascadeScopeForSchedule(scheduleId);

  return runCascade({
    scope,
    entity: "ExamSchedule",
    entityId: scheduleId,
    actorId,
    ipAddress,
    details: {
      scope: "exam_schedule",
      affectedExamRooms: scope.examRoomIds,
    },
    finalize: async (session) => {
      // Seat-sharing cascade for a schedule delete: restore seats for
      // allocations where this schedule was the consumer, and drop
      // configs+allocations for each ExamRoom of this schedule as a source.
      await seatSharingService.releaseByConsumerSchedule({
        consumerScheduleId: scheduleId,
        session,
      });
      for (const erId of scope.examRoomIds) {
        await seatSharingService.releaseByExamRoomAsSource({
          examRoomId: erId,
          session,
        });
      }

      await dcsGroupRepository.deleteBySchedules([scheduleId], session);
      if (scope.examRoomIds.length > 0) {
        await ExamRoom.deleteMany(
          { _id: { $in: scope.examRoomIds } },
          session ? { session } : {},
        );
      }
      await ExamSchedule.findByIdAndDelete(
        scheduleId,
        session ? { session } : {},
      );
    },
  });
};

const deleteExamRoomWithCleanup = async (
  examRoomId,
  { actorId, ipAddress } = {},
) => {
  if (!actorId) throw new AppError("Actor (user) is required for deletion", 400);

  const room = await examRoomRepository.findById(examRoomId);
  if (!room) throw new AppError("Exam room assignment not found", 404);

  const scope = await getCascadeScopeForExamRoom(examRoomId);

  return runCascade({
    scope,
    entity: "ExamRoom",
    entityId: examRoomId,
    actorId,
    ipAddress,
    details: { scope: "exam_room" },
    finalize: async (session) => {
      // Seat-sharing cascade: this specific room is going away, so its
      // sharing config and any consumer allocations sourced from it die too.
      await seatSharingService.releaseByExamRoomAsSource({
        examRoomId,
        session,
      });

      await ExamRoom.findByIdAndDelete(
        examRoomId,
        session ? { session } : {},
      );
    },
  });
};

// Legacy single-Exam soft cancel. Kept for the older /exams flow. Same
// cascade contract: release duties referencing this exam, cancel open
// change-requests, notify teachers, audit.
const cancelExamWithCleanup = async (
  examId,
  { actorId, ipAddress } = {},
) => {
  if (!actorId) throw new AppError("Actor (user) is required for deletion", 400);

  const exam = await examRepository.findById(examId);
  if (!exam) throw new AppError("Exam not found", 404);
  if (exam.status === "completed") {
    throw new AppError("Cannot cancel a completed exam", 400);
  }

  const scope = await getCascadeScopeForExam(examId);

  return runCascade({
    scope,
    entity: "Exam",
    entityId: examId,
    actorId,
    ipAddress,
    details: {
      scope: "exam_legacy",
      examName: exam.name,
      examSemester: exam.semester,
    },
    finalize: async (session) => {
      await Exam.findByIdAndUpdate(
        examId,
        { isCancelled: true, cancelledAt: new Date() },
        session ? { session } : {},
      );
    },
  });
};

module.exports = {
  deleteExamGroupWithCleanup,
  deleteScheduleWithCleanup,
  deleteExamRoomWithCleanup,
  cancelExamWithCleanup,
};
