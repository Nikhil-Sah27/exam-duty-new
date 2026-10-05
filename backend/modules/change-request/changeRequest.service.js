const AppError = require("../../shared/utils/AppError");
const { withOptionalTransaction } = require("../../shared/utils/withOptionalTransaction");
const changeRequestRepository = require("./changeRequest.repository");
const Duty = require("../duty/duty.model");
const User = require("../auth/auth.model");
const examGroupRepo = require("../exam/examGroup.repository");
const examScheduleRepo = require("../exam/examSchedule.repository");
const examRoomRepo = require("../exam/examRoom.repository");
const dcsGroupRepository = require("../dcs/dcsGroup.repository");
const dutyRepository = require("../duty/duty.repository");
const { emit, emitToMany } = require("../notification/notification.emitter");

// ---------- Helpers ----------

// Change-request review is a CS-only responsibility (DCS is a duty role, not an
// admin role), so submission notifications fan out to active CS users only.
const getReviewerIds = async () => {
  const reviewers = await User.find({ roles: "cs", isActive: true }).select("_id");
  return reviewers.map((r) => r._id);
};

// Requester's display name for the "New Change Request" notification/email, so
// CS sees WHO wants the change (e.g. "Aarti Rao requested a move…").
const getRequesterName = async (userId) => {
  const u = await User.findById(userId).select("name");
  return u?.name || "A teacher";
};

// ---------- Submit ----------

// ---------- Time-conflict helper (used by move submit + replacement filtering) ----------

const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const overlaps = (aStart, aEnd, bStart, bEnd) =>
  minutesOf(aStart) < minutesOf(bEnd) && minutesOf(bStart) < minutesOf(aEnd);

const sameDay = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return da.getTime() === db.getTime();
};

const isInvigilatorAlreadyAssigned = async (date, startTime, endTime, roomNumber, roomId, roomRef) => {
  // Prefer scoping by the physical Room _id (building-aware). Only fall back
  // to the legacy string `room` field for very old duties without roomRef.
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const filter = {
    date: { $gte: day, $lt: nextDay },
    startTime,
    endTime,
    status: "assigned",
  };
  if (roomRef) {
    filter.roomRef = roomRef;
  } else {
    filter.$or = [{ room: roomNumber }, { room: roomId }];
  }
  const duties = await Duty.find(filter);

  return duties.some((d) => d.role === "invigilator");
};

const validateMoveTarget = async ({ requestedSchedule, requestedExamRoom, userId, currentDutyId }) => {
  if (!requestedSchedule || !requestedExamRoom) {
    throw new AppError("Target schedule and room are required for a move request", 400);
  }

  const [schedule, examRoom] = await Promise.all([
    examScheduleRepo.findById(requestedSchedule),
    examRoomRepo.findById(requestedExamRoom),
  ]);

  if (!schedule) throw new AppError("Target schedule not found", 404);
  if (!examRoom) throw new AppError("Target exam room not found", 404);
  if (examRoom.schedule.toString() !== requestedSchedule.toString()) {
    throw new AppError("Target room does not belong to target schedule", 400);
  }

  // Reject targets in completed groups
  const group = await examGroupRepo.findById(schedule.examGroup);
  if (group) {
    const now = new Date();
    if (new Date(group.endDate) < now) {
      throw new AppError("Target exam group is already completed", 400);
    }
  }

  // Time-conflict check against the user's other active duties (excluding the current duty being moved)
  const otherDuties = await Duty.find({
    teacher: userId,
    status: "assigned",
    _id: { $ne: currentDutyId },
  });
  for (const d of otherDuties) {
    if (!sameDay(d.date, schedule.date)) continue;
    if (overlaps(d.startTime, d.endTime, schedule.startTime, schedule.endTime)) {
      throw new AppError(
        `Time conflict with your duty at ${d.room} (${d.startTime}–${d.endTime}) on the same day`,
        409
      );
    }
  }

  return { schedule, examRoom };
};

// ---------- DCS group swap submit ----------

/**
 * DCS swap path. Reuses the same /change-requests endpoint as duty-scoped
 * requests but operates on whole DCSGroups, not individual rooms. The
 * teacher submits {sourceGroupId, targetGroupId, reason}; the body's
 * type === "dcs_swap" routes us here.
 *
 * Validation mirrors the DCS claim flow (date in future, no time conflict
 * with the requester's other duties) so an approval can succeed later.
 */
const submitDcsGroupSwap = async (
  { dcsSourceGroup, dcsTargetGroup, reason },
  userId
) => {
  if (!dcsSourceGroup || !dcsTargetGroup) {
    throw new AppError("Source and target DCS groups are required", 400);
  }
  if (String(dcsSourceGroup) === String(dcsTargetGroup)) {
    throw new AppError("Source and target groups must differ", 400);
  }

  const [source, target] = await Promise.all([
    dcsGroupRepository.findById(dcsSourceGroup),
    dcsGroupRepository.findById(dcsTargetGroup),
  ]);
  if (!source) throw new AppError("Source DCS group not found", 404);
  if (!target) throw new AppError("Target DCS group not found", 404);

  // Only the DCS who currently owns the source group can request to move off it.
  if (
    !source.assignedTeacher ||
    String(source.assignedTeacher._id || source.assignedTeacher) !== String(userId)
  ) {
    throw new AppError("You don't own the source DCS group", 403);
  }
  if (source.status !== "claimed") {
    throw new AppError("Source DCS group is not claimed", 400);
  }

  // Target must be free.
  if (target.status !== "open" || target.assignedTeacher) {
    throw new AppError("Target DCS group is already taken", 409);
  }

  // Target date/time validations — same gates as claimGroup.
  const now = new Date();
  const day = new Date(target.schedule.date);
  day.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (day < today) {
    throw new AppError("Target schedule has already passed", 400);
  }

  // Reject if the requester has any *other* duty (outside the source group)
  // that conflicts with the target's time window — they couldn't actually
  // serve the target if approved.
  const sourceDutyIds = (source.duties || []).map(String);
  const otherDuties = await Duty.find({
    teacher: userId,
    status: "assigned",
    _id: { $nin: sourceDutyIds },
  });
  for (const d of otherDuties) {
    if (!sameDay(d.date, target.schedule.date)) continue;
    if (overlaps(d.startTime, d.endTime, target.schedule.startTime, target.schedule.endTime)) {
      throw new AppError(
        `Time conflict with your duty at ${d.room} (${d.startTime}–${d.endTime}) on the target date`,
        409
      );
    }
  }

  const existing = await changeRequestRepository.findPendingDcsByUserAndSource(
    dcsSourceGroup,
    userId
  );
  if (existing) {
    throw new AppError("You already have a pending swap for this DCS group", 409);
  }

  const request = await changeRequestRepository.create({
    scope: "dcs_group",
    type: "dcs_swap",
    requestedBy: userId,
    reason,
    dcsSourceGroup,
    dcsTargetGroup,
  });

  const reviewerIds = await getReviewerIds();
  emitToMany("request_submitted", {
    recipients: reviewerIds,
    refModel: "ChangeRequest",
    refId: request._id,
    data: {
      type: "DCS swap",
      date: target.schedule.date,
      by: await getRequesterName(userId),
    },
  });

  return request;
};

// ---------- RS group swap submit ----------

/**
 * Compute a deterministic composite key for an RS group given its schedule +
 * building + chunkIndex. Mirrors the frontend groupId format so pending-swap
 * uniqueness on (rsSourceKey, requester) matches the RS's own mental model
 * of "one group card = one swap in flight."
 */
const buildRsGroupKey = (scheduleId, buildingId, chunkIndex) =>
  `${scheduleId}:${buildingId}:${chunkIndex}`;

/**
 * Validate an RS group swap submission and persist it. Source is described by
 * the set of duty IDs the RS currently holds in that group; target by the
 * examRoom IDs of the group they'd like to move to. All source duties must
 * belong to the caller, all target examRooms must share one schedule +
 * building, and the target must be free of RS assignments today.
 */
const submitRsGroupSwap = async (
  {
    rsSourceDuties,
    rsTargetExamRooms,
    rsSourceKey,
    rsTargetKey,
    reason,
  },
  userId
) => {
  if (!Array.isArray(rsSourceDuties) || rsSourceDuties.length === 0) {
    throw new AppError("Source group duties are required", 400);
  }
  if (!Array.isArray(rsTargetExamRooms) || rsTargetExamRooms.length === 0) {
    throw new AppError("Target group rooms are required", 400);
  }
  if (!rsSourceKey || !rsTargetKey) {
    throw new AppError("Source and target group keys are required", 400);
  }
  if (rsSourceKey === rsTargetKey) {
    throw new AppError("Source and target groups must differ", 400);
  }

  // ── 1. Validate source ─────────────────────────────────────────────────
  const sourceDuties = await Duty.find({ _id: { $in: rsSourceDuties } })
    .populate({
      path: "examSchedule",
      select: "date startTime endTime",
    })
    .populate({
      path: "examRoom",
      select: "room",
      populate: { path: "room", select: "building" },
    });

  if (sourceDuties.length !== rsSourceDuties.length) {
    throw new AppError("One or more source duties no longer exist", 404);
  }
  for (const d of sourceDuties) {
    if (String(d.teacher) !== String(userId)) {
      throw new AppError("You can only swap groups you own", 403);
    }
    if (d.status !== "assigned") {
      throw new AppError(
        "One or more source duties are no longer assigned",
        400
      );
    }
  }

  // Source must be a single group — same schedule + same building.
  const sourceScheduleId = String(sourceDuties[0].examSchedule?._id);
  const sourceBuildingId = String(
    sourceDuties[0].examRoom?.room?.building?._id ||
      sourceDuties[0].examRoom?.room?.building ||
      ""
  );
  for (const d of sourceDuties) {
    const sid = String(d.examSchedule?._id);
    const bid = String(
      d.examRoom?.room?.building?._id || d.examRoom?.room?.building || ""
    );
    if (sid !== sourceScheduleId || bid !== sourceBuildingId) {
      throw new AppError(
        "Source duties must all belong to the same group (same schedule + building)",
        400
      );
    }
  }

  // ── 2. Validate target ────────────────────────────────────────────────
  const targetExamRooms = await examRoomRepo.findManyByIds(rsTargetExamRooms);
  if (targetExamRooms.length !== rsTargetExamRooms.length) {
    throw new AppError("One or more target rooms no longer exist", 404);
  }

  const targetScheduleId = String(targetExamRooms[0].schedule?._id || targetExamRooms[0].schedule);
  const targetBuildingId = String(
    targetExamRooms[0].room?.building?._id || targetExamRooms[0].room?.building || ""
  );
  for (const er of targetExamRooms) {
    const sid = String(er.schedule?._id || er.schedule);
    const bid = String(er.room?.building?._id || er.room?.building || "");
    if (sid !== targetScheduleId || bid !== targetBuildingId) {
      throw new AppError(
        "Target rooms must all belong to the same group (same schedule + building)",
        400
      );
    }
  }

  const targetSchedule = await examScheduleRepo.findById(targetScheduleId);
  if (!targetSchedule) throw new AppError("Target schedule not found", 404);

  // Target date must be in the future (same rule as select-duty).
  const now = new Date();
  const day = new Date(targetSchedule.date);
  day.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (day < today) {
    throw new AppError("Target schedule has already passed", 400);
  }

  // Every target room must be free of an RS duty right now.
  const teacher = await User.findById(userId).select("role");
  if (!teacher) throw new AppError("Requester not found", 404);
  const sourceDutyIds = sourceDuties.map((d) => String(d._id));

  for (const er of targetExamRooms) {
    const roomRef = er.room?._id || er.room || null;
    const dayStart = new Date(targetSchedule.date);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const filter = {
      date: { $gte: dayStart, $lt: nextDay },
      startTime: targetSchedule.startTime,
      endTime: targetSchedule.endTime,
      status: "assigned",
      _id: { $nin: sourceDutyIds },
    };
    if (roomRef) filter.roomRef = roomRef;
    else filter.room = er.room?.roomNumber || "";
    const conflicts = await Duty.find(filter);
    if (conflicts.some((c) => c.role === "rs")) {
      throw new AppError(
        "One or more target rooms already have an RS assigned",
        409
      );
    }
  }

  // Requester must not have OTHER duties (outside source) that clash with
  // the target's time window on the target date.
  const otherDuties = await Duty.find({
    teacher: userId,
    status: "assigned",
    _id: { $nin: sourceDutyIds },
  });
  for (const d of otherDuties) {
    if (!sameDay(d.date, targetSchedule.date)) continue;
    if (
      overlaps(
        d.startTime,
        d.endTime,
        targetSchedule.startTime,
        targetSchedule.endTime
      )
    ) {
      throw new AppError(
        `Time conflict with your duty at ${d.room} (${d.startTime}–${d.endTime}) on the target date`,
        409
      );
    }
  }

  // ── 3. Enforce single pending swap per source group ───────────────────
  const existing =
    await changeRequestRepository.findPendingRsByUserAndSourceKey(
      rsSourceKey,
      userId
    );
  if (existing) {
    throw new AppError(
      "You already have a pending swap for this RS group",
      409
    );
  }

  // ── 4. Persist ─────────────────────────────────────────────────────────
  const request = await changeRequestRepository.create({
    scope: "rs_group",
    type: "rs_swap",
    requestedBy: userId,
    reason,
    rsSourceDuties,
    rsTargetExamRooms,
    rsSourceKey,
    rsTargetKey,
  });

  const reviewerIds = await getReviewerIds();
  emitToMany("request_submitted", {
    recipients: reviewerIds,
    refModel: "ChangeRequest",
    refId: request._id,
    data: {
      type: "RS swap",
      date: targetSchedule.date,
      by: await getRequesterName(userId),
    },
  });

  return request;
};

// ---------- Submit ----------

const submitRequest = async (
  {
    duty: dutyId,
    type,
    reason,
    swapWith,
    requestedSchedule,
    requestedExamRoom,
    dcsSourceGroup,
    dcsTargetGroup,
    rsSourceDuties,
    rsTargetExamRooms,
    rsSourceKey,
    rsTargetKey,
  },
  userId
) => {
  // DCS group swap fork — uses different identifiers, so route early.
  if (type === "dcs_swap") {
    return submitDcsGroupSwap({ dcsSourceGroup, dcsTargetGroup, reason }, userId);
  }

  // RS group swap fork — mirrors DCS but on client-derived groups.
  if (type === "rs_swap") {
    return submitRsGroupSwap(
      {
        rsSourceDuties,
        rsTargetExamRooms,
        rsSourceKey,
        rsTargetKey,
        reason,
      },
      userId
    );
  }

  const duty = await Duty.findById(dutyId);
  if (!duty) throw new AppError("Duty not found", 404);
  if (duty.status !== "assigned") {
    throw new AppError("Can only request changes for assigned duties", 400);
  }

  if (duty.teacher.toString() !== userId) {
    throw new AppError("You can only request changes for your own duties", 403);
  }

  // Reject requests on past/completed duties
  if (new Date(duty.date) < new Date()) {
    // Allow same-day; only reject if the date itself is fully past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dutyDay = new Date(duty.date);
    dutyDay.setHours(0, 0, 0, 0);
    if (dutyDay < today) {
      throw new AppError("Cannot request changes for a past duty", 400);
    }
  }

  const existing = await changeRequestRepository.findPendingByDutyAndUser(dutyId, userId);
  if (existing) {
    throw new AppError("You already have a pending request for this duty", 409);
  }

  if (type === "swap") {
    if (!swapWith) throw new AppError("Swap target teacher is required", 400);
    const target = await User.findById(swapWith);
    if (!target) throw new AppError("Swap target teacher not found", 404);
    if (!target.isActive) throw new AppError("Swap target teacher is deactivated", 400);
    if (swapWith === userId) throw new AppError("Cannot swap with yourself", 400);
  }

  let movePayload = {};
  if (type === "move") {
    const { schedule, examRoom } = await validateMoveTarget({
      requestedSchedule,
      requestedExamRoom,
      userId,
      currentDutyId: dutyId,
    });

    // examRoomRepo.findById already populates `room` (with building); reuse it.
    const alreadyTaken = await isInvigilatorAlreadyAssigned(
      schedule.date,
      schedule.startTime,
      schedule.endTime,
      examRoom?.room?.roomNumber || "",
      examRoom?.room?._id?.toString() || "",
      examRoom?.room?._id || null
    );
    if (alreadyTaken) {
      throw new AppError("Target slot already has an invigilator assigned", 409);
    }

    movePayload = {
      requestedSchedule: schedule._id,
      requestedExamRoom: examRoom._id,
      requestedRoom: examRoom?.room?.roomNumber || "",
      requestedDate: schedule.date,
      requestedStartTime: schedule.startTime,
      requestedEndTime: schedule.endTime,
    };
  }

  const request = await changeRequestRepository.create({
    duty: dutyId,
    requestedBy: userId,
    type,
    reason,
    swapWith: type === "swap" ? swapWith : null,
    ...movePayload,
  });

  const reviewerIds = await getReviewerIds();
  emitToMany("request_submitted", {
    recipients: reviewerIds,
    refModel: "ChangeRequest",
    refId: request._id,
    data: { type, date: duty.date, by: await getRequesterName(userId) },
  });

  return request;
};

// ---------- List ----------

const getAllRequests = async (query) => {
  const filter = {};

  if (query.status) filter.status = query.status;
  if (query.requestedBy) filter.requestedBy = query.requestedBy;
  if (query.type) filter.type = query.type;

  return changeRequestRepository.findAll(filter);
};

const getRequestById = async (id) => {
  const request = await changeRequestRepository.findById(id);
  if (!request) throw new AppError("Change request not found", 404);
  return request;
};

const getMyRequests = async (userId) => {
  return changeRequestRepository.findAll({ requestedBy: userId });
};

/**
 * Delete a change-request record (CS-only). This removes the request from the
 * review list/history; it does NOT revert any duty change a prior approval
 * already applied. Returns the (populated) request so the caller can write an
 * audit entry describing what was removed.
 */
const deleteRequest = async (id) => {
  const request = await changeRequestRepository.findById(id);
  if (!request) throw new AppError("Change request not found", 404);
  await changeRequestRepository.deleteById(id);
  return request;
};

// ---------- DCS group swap approve ----------

/**
 * Approve a DCS group swap by atomically releasing the requester from the
 * source group and claiming the target group on their behalf. Mirrors the
 * release + claim flows in dcsGroup.service so duties, group status, and
 * downstream queries all stay consistent — no separate "swap" code path.
 */
const approveDcsGroupSwap = async (request, reviewerId, reviewNote) => {
  // Refresh both groups so we have the latest state before mutating.
  const [source, target] = await Promise.all([
    dcsGroupRepository.findById(request.dcsSourceGroup._id),
    dcsGroupRepository.findById(request.dcsTargetGroup._id),
  ]);
  if (!source) throw new AppError("Source DCS group no longer exists", 404);
  if (!target) throw new AppError("Target DCS group no longer exists", 404);

  // Auto-reject if the target was claimed by someone else in the meantime.
  if (target.status !== "open" || target.assignedTeacher) {
    return changeRequestRepository.updateById(request._id, {
      status: "rejected",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote: "Target DCS group is no longer available.",
    });
  }

  const requesterId = request.requestedBy._id || request.requestedBy;

  // Sanity: source must still belong to the requester. If admin had already
  // released the user by other means, fail rather than silently dropping the
  // approval.
  if (
    !source.assignedTeacher ||
    String(source.assignedTeacher._id || source.assignedTeacher) !== String(requesterId)
  ) {
    throw new AppError("Source group is no longer owned by the requester", 409);
  }

  const updated = await withOptionalTransaction(async (session) => {
    const sessionOpt = session ? { session } : undefined;

    // ── 1. Release the source group (mirror dcsGroup.releaseGroup) ─────────
    await Duty.updateMany(
      { _id: { $in: source.duties || [] } },
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: "Approved DCS swap",
      },
      sessionOpt
    );
    await dcsGroupRepository.updateById(
      source._id,
      { assignedTeacher: null, status: "open", duties: [] },
      session
    );

    // ── 2. Claim the target group (mirror dcsGroup.claimGroup) ─────────────
    const newDutyIds = [];
    for (const examRoom of target.assignedRooms) {
      const roomNumber = examRoom?.room?.roomNumber || "";
      const roomRef = examRoom?.room?._id || null;
      const duty = await dutyRepository.create(
        {
          exam: null,
          examSchedule: target.schedule._id,
          examRoom: examRoom._id,
          teacher: requesterId,
          role: "dcs",
          room: roomNumber,
          roomRef,
          date: target.schedule.date,
          startTime: target.schedule.startTime,
          endTime: target.schedule.endTime,
          assignedBy: reviewerId,
          isSelfAssigned: false,
          // The requester asked for this group — nothing to confirm.
          confirmedAt: new Date(),
          confirmedVia: "request",
        },
        session
      );
      newDutyIds.push(duty._id);
    }
    await dcsGroupRepository.updateById(
      target._id,
      { assignedTeacher: requesterId, status: "claimed", duties: newDutyIds },
      session
    );

    return changeRequestRepository.updateById(request._id, {
      status: "approved",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote: reviewNote || null,
    });
  });

  emit("request_approved", {
    recipient: requesterId,
    refModel: "ChangeRequest",
    refId: request._id,
    data: { type: "DCS swap", reviewNote },
  });

  return updated;
};

// ---------- RS group swap approve ----------

/**
 * Approve an RS group swap: atomically cancel the requester's source-group
 * duties and create fresh duties on every examRoom in the target group.
 * Mirrors approveDcsGroupSwap in structure; the difference is that RS groups
 * are described by concrete duty + examRoom snapshots rather than a
 * persistent group document.
 */
const approveRsGroupSwap = async (request, reviewerId, reviewNote) => {
  const requesterId = request.requestedBy._id || request.requestedBy;

  // Refresh source duties — they're stored fully populated on the request,
  // but we need live status to avoid overwriting an admin-side cancellation.
  const sourceDuties = await Duty.find({
    _id: { $in: (request.rsSourceDuties || []).map((d) => d._id || d) },
  });
  if (sourceDuties.length === 0) {
    throw new AppError("Source RS group no longer exists", 404);
  }
  for (const d of sourceDuties) {
    if (String(d.teacher) !== String(requesterId)) {
      throw new AppError(
        "Source group is no longer owned by the requester",
        409
      );
    }
    if (d.status !== "assigned") {
      throw new AppError("One or more source duties are already cancelled", 409);
    }
  }

  // Refresh target examRooms and confirm none has been claimed by another RS
  // since the request was filed.
  const targetIds = (request.rsTargetExamRooms || []).map((r) => r._id || r);
  const targetExamRooms = await examRoomRepo.findManyByIds(targetIds);
  if (targetExamRooms.length !== targetIds.length) {
    throw new AppError("One or more target rooms no longer exist", 404);
  }

  const targetScheduleId = String(
    targetExamRooms[0].schedule?._id || targetExamRooms[0].schedule
  );
  const targetSchedule = await examScheduleRepo.findById(targetScheduleId);
  if (!targetSchedule) throw new AppError("Target schedule not found", 404);

  const sourceDutyIds = sourceDuties.map((d) => String(d._id));
  for (const er of targetExamRooms) {
    const roomRef = er.room?._id || er.room || null;
    const dayStart = new Date(targetSchedule.date);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const filter = {
      date: { $gte: dayStart, $lt: nextDay },
      startTime: targetSchedule.startTime,
      endTime: targetSchedule.endTime,
      status: "assigned",
      _id: { $nin: sourceDutyIds },
    };
    if (roomRef) filter.roomRef = roomRef;
    else filter.room = er.room?.roomNumber || "";
    const conflicts = await Duty.find(filter);
    if (conflicts.some((c) => c.role === "rs")) {
      return changeRequestRepository.updateById(request._id, {
        status: "rejected",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: "Target RS group is no longer available.",
      });
    }
  }

  const updated = await withOptionalTransaction(async (session) => {
    const sessionOpt = session ? { session } : undefined;

    // ── 1. Cancel source-group duties ──────────────────────────────────
    await Duty.updateMany(
      { _id: { $in: sourceDutyIds } },
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: "Approved RS swap",
      },
      sessionOpt
    );

    // ── 2. Create target-group duties ──────────────────────────────────
    for (const examRoom of targetExamRooms) {
      const roomNumber = examRoom?.room?.roomNumber || "";
      const roomRef = examRoom?.room?._id || null;
      await dutyRepository.create(
        {
          exam: null,
          examSchedule: targetSchedule._id,
          examRoom: examRoom._id,
          teacher: requesterId,
          role: "rs",
          room: roomNumber,
          roomRef,
          date: targetSchedule.date,
          startTime: targetSchedule.startTime,
          endTime: targetSchedule.endTime,
          assignedBy: reviewerId,
          isSelfAssigned: false,
          // The requester asked for this group — nothing to confirm.
          confirmedAt: new Date(),
          confirmedVia: "request",
        },
        session
      );
    }

    return changeRequestRepository.updateById(request._id, {
      status: "approved",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote: reviewNote || null,
    });
  });

  emit("request_approved", {
    recipient: requesterId,
    refModel: "ChangeRequest",
    refId: request._id,
    data: { type: "RS swap", reviewNote },
  });

  return updated;
};

// ---------- Approve ----------

const approveRequest = async (id, reviewerId, reviewNote) => {
  const request = await changeRequestRepository.findById(id);
  if (!request) throw new AppError("Change request not found", 404);
  if (request.status !== "pending") {
    throw new AppError(`Request is already ${request.status}`, 400);
  }

  // DCS group swap branches out early — it moves a whole bundle of duties,
  // not a single duty, so the per-duty paths below don't apply.
  if (request.scope === "dcs_group") {
    return approveDcsGroupSwap(request, reviewerId, reviewNote);
  }

  // RS group swap follows the same "bundle" shape.
  if (request.scope === "rs_group") {
    return approveRsGroupSwap(request, reviewerId, reviewNote);
  }

  // Move requests need a vacancy re-check BEFORE we start mutating. If the
  // target slot was claimed since the request was filed, auto-reject with a
  // clear note and exit early — no transaction required.
  if (request.type === "move") {
    const stillVacant = !(await isInvigilatorAlreadyAssigned(
      request.requestedDate,
      request.requestedStartTime,
      request.requestedEndTime,
      request.requestedRoom,
      "",
      request.requestedExamRoom?.room?._id || request.requestedExamRoom?.room || null
    ));
    if (!stillVacant) {
      return changeRequestRepository.updateById(id, {
        status: "rejected",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: "Requested duty no longer available.",
      });
    }
  }

  const updated = await withOptionalTransaction(async (session) => {
    const sessionOpt = session ? { session } : undefined;

    if (request.type === "drop") {
      await Duty.findByIdAndUpdate(
        request.duty._id,
        { status: "cancelled", cancelledAt: new Date(), cancelReason: "Approved drop request" },
        sessionOpt
      );
    }

    if (request.type === "swap") {
      await Duty.findByIdAndUpdate(
        request.duty._id,
        // The new holder didn't ask for it, so they confirm it themselves.
        { teacher: request.swapWith._id, confirmedAt: null, confirmedVia: null },
        sessionOpt
      );
    }

    if (request.type === "move") {
      const oldDutyQuery = Duty.findById(request.duty._id);
      const oldDuty = session ? await oldDutyQuery.session(session) : await oldDutyQuery;
      if (!oldDuty) {
        throw new AppError("Original duty not found", 404);
      }

      await Duty.findByIdAndUpdate(
        request.duty._id,
        {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelReason: "Approved move request",
        },
        sessionOpt
      );

      const requestedRoomRef =
        request.requestedExamRoom?.room?._id ||
        request.requestedExamRoom?.room ||
        null;

      await Duty.create(
        [
          {
            exam: oldDuty.exam || null,
            examSchedule: request.requestedSchedule,
            examRoom: request.requestedExamRoom,
            teacher: oldDuty.teacher,
            role: oldDuty.role || "invigilator",
            room: request.requestedRoom,
            roomRef: requestedRoomRef,
            date: request.requestedDate,
            startTime: request.requestedStartTime,
            endTime: request.requestedEndTime,
            assignedBy: reviewerId,
            isSelfAssigned: false,
            status: "assigned",
            // The teacher asked for this move — nothing to confirm.
            confirmedAt: new Date(),
            confirmedVia: "request",
          },
        ],
        sessionOpt
      );
    }

    return changeRequestRepository.updateById(id, {
      status: "approved",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote: reviewNote || null,
    });
  });

  emit("request_approved", {
    recipient: request.requestedBy._id,
    refModel: "ChangeRequest",
    refId: request._id,
    data: { type: request.type, reviewNote },
  });

  if (request.type === "swap" && request.swapWith) {
    emit("duty_swapped", {
      recipient: request.swapWith._id,
      refModel: "Duty",
      refId: request.duty._id,
      data: {},
    });
  }

  return updated;
};

// ---------- Reject ----------

const rejectRequest = async (id, reviewerId, reviewNote) => {
  const request = await changeRequestRepository.findById(id);
  if (!request) throw new AppError("Change request not found", 404);
  if (request.status !== "pending") {
    throw new AppError(`Request is already ${request.status}`, 400);
  }

  const updated = await changeRequestRepository.updateById(id, {
    status: "rejected",
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
    reviewNote: reviewNote || null,
  });

  emit("request_rejected", {
    recipient: request.requestedBy._id,
    refModel: "ChangeRequest",
    refId: request._id,
    data: { type: request.type, reviewNote },
  });

  return updated;
};

// ---------- Replacement slot derivation ----------

/**
 * For a given duty owned by `userId`, return the list of available replacement
 * slots (one entry per ExamSchedule × ExamRoom in active groups). A slot is
 * "available" when:
 *   - not the same slot as the current duty
 *   - schedule date is not in the past
 *   - no invigilator has been assigned to that room+time yet
 *   - no time conflict with the user's other active duties
 */
const getAvailableReplacements = async (dutyId, userId) => {
  const duty = await Duty.findById(dutyId);
  if (!duty) throw new AppError("Duty not found", 404);
  if (duty.teacher.toString() !== userId) {
    throw new AppError("You can only view replacements for your own duties", 403);
  }

  // Fetch active groups + their schedules + rooms, plus user's other duties.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeGroups = await examGroupRepo.findAllWithStats({});
  const upcomingGroups = activeGroups.filter((g) => new Date(g.endDate) >= today);

  const otherDuties = await Duty.find({
    teacher: userId,
    status: "assigned",
    _id: { $ne: dutyId },
  });

  const results = [];

  for (const group of upcomingGroups) {
    const schedules = await examScheduleRepo.findByExamGroup(group._id);
    const scheduleIds = schedules.map((s) => s._id);
    const rooms = await examRoomRepo.findBySchedules(scheduleIds);

    // Quick lookup: scheduleId -> [examRoom]
    const roomsBySchedule = new Map();
    for (const r of rooms) {
      const key = r.schedule.toString();
      if (!roomsBySchedule.has(key)) roomsBySchedule.set(key, []);
      roomsBySchedule.get(key).push(r);
    }

    for (const schedule of schedules) {
      const day = new Date(schedule.date);
      day.setHours(0, 0, 0, 0);
      if (day < today) continue;

      // Time conflict against user's other duties
      const hasConflict = otherDuties.some(
        (d) =>
          sameDay(d.date, schedule.date) &&
          overlaps(d.startTime, d.endTime, schedule.startTime, schedule.endTime)
      );
      if (hasConflict) continue;

      const examRooms = roomsBySchedule.get(schedule._id.toString()) || [];
      for (const er of examRooms) {
        // Skip the slot that matches the user's current duty
        const isSameSlot =
          sameDay(duty.date, schedule.date) &&
          duty.startTime === schedule.startTime &&
          duty.endTime === schedule.endTime &&
          (duty.room === er.room?.roomNumber || duty.room === er.room?._id?.toString());
        if (isSameSlot) continue;

        const occupied = await isInvigilatorAlreadyAssigned(
          schedule.date,
          schedule.startTime,
          schedule.endTime,
          er.room?.roomNumber || "",
          er.room?._id?.toString() || "",
          er.room?._id || null
        );
        if (occupied) continue;

        results.push({
          scheduleId: schedule._id,
          examRoomId: er._id,
          examGroupId: group._id,
          examType: group.examType,
          semester: group.semester,
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          roomId: er.room?._id,
          roomNumber: er.room?.roomNumber,
          floor: er.room?.floor,
          capacity: er.room?.capacity,
          buildingName: er.room?.building?.name,
          departments: er.departments || [],
        });
      }
    }
  }

  return results;
};

module.exports = {
  submitRequest,
  getAllRequests,
  getRequestById,
  getMyRequests,
  deleteRequest,
  approveRequest,
  rejectRequest,
  getAvailableReplacements,
};
