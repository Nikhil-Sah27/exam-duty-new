// Public service for the global seat-sharing workflow.
//
// Rules enforced here:
//   1. Room reservations remain unique (RoomReservationService is untouched).
//   2. Only ExamRooms whose owner has explicitly opted in are shareable.
//   3. Consumers borrow a fixed number of seats and never allocate more than
//      the remaining pool (atomic $gte guard on the counter).
//   4. Deleting the source group removes all configs + dependent allocations.
//   5. Deleting a consumer group restores the seats to the pool.
//
// All mutating methods accept an optional Mongo session so callers inside
// `withOptionalTransaction` blocks can enlist this work in the same commit.

const AppError = require("../../shared/utils/AppError");
const {
  timesOverlap,
  normalizeDay,
  slotKeyOf,
} = require("../exam/roomReservation.utils");
const ExamRoom = require("../exam/examRoom.model");
const ExamSchedule = require("../exam/examSchedule.model");
const repo = require("./seatSharing.repository");

// ────────────────────────────────────────────────────────────────
// Discovery — used by the room-assignment step of NEW exam groups
// ────────────────────────────────────────────────────────────────

/**
 * Given a list of time windows the caller is planning to schedule an exam in,
 * return every globally-shareable room whose OWNER schedule overlaps that
 * window on the same day.
 *
 *   input:  { slots: [{date, startTime, endTime}], excludeExamGroupId? }
 *   output: { [slotKey]: ShareableRoomOption[] }
 *
 * `slotKey` matches `slotKeyOf(date, startTime, endTime)` so the frontend can
 * index the map with the same key it uses for `getReservationsForSlots`.
 */
const findShareableRoomsForSlots = async ({
  slots,
  excludeExamGroupId = null,
} = {}) => {
  if (!Array.isArray(slots) || slots.length === 0) return {};

  const uniqueDays = [
    ...new Set(slots.map((s) => normalizeDay(s.date).toISOString())),
  ].map((iso) => new Date(iso));

  // 1) All owner schedules on the requested days.
  const dayRanges = uniqueDays.map((d) => {
    const start = normalizeDay(d);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  });

  const schedules = await ExamSchedule.find({
    $or: dayRanges.map(({ start, end }) => ({
      date: { $gte: start, $lt: end },
    })),
  }).populate({
    path: "examGroup",
    select: "examType semester isActive",
  });

  const liveSchedules = schedules.filter((s) => {
    if (!s.examGroup) return false;
    if (
      excludeExamGroupId &&
      String(s.examGroup._id) === String(excludeExamGroupId)
    ) {
      return false;
    }
    return true;
  });

  if (liveSchedules.length === 0) return {};

  // 2) Active configs whose sourceSchedule is one of those schedules.
  const scheduleIds = liveSchedules.map((s) => s._id);
  const configs = await repo.listActiveConfigsForSchedules(scheduleIds);
  if (configs.length === 0) return {};

  // 3) Denormalise the ExamRoom + Room + Building for the response.
  const examRoomIds = configs.map((c) => c.examRoom);
  const examRooms = await ExamRoom.find({ _id: { $in: examRoomIds } }).populate({
    path: "room",
    select: "roomNumber floor building capacity",
    populate: { path: "building", select: "name" },
  });
  const examRoomById = new Map(examRooms.map((r) => [String(r._id), r]));
  const scheduleById = new Map(
    liveSchedules.map((s) => [String(s._id), s])
  );

  // 4) Bucket each config into every input slot whose window overlaps.
  const bySlot = {};
  for (const slot of slots) {
    const key = slotKeyOf(slot.date, slot.startTime, slot.endTime);
    bySlot[key] = [];
  }

  for (const config of configs) {
    const sched = scheduleById.get(String(config.sourceSchedule));
    if (!sched) continue;

    const room = examRoomById.get(String(config.examRoom));
    if (!room || !room.room) continue;

    const option = {
      examRoomId: String(config.examRoom),
      configurationId: String(config._id),
      roomId: String(room.room._id),
      roomNumber: room.room.roomNumber,
      buildingName: room.room.building?.name || "",
      roomCapacity: room.room.capacity,
      remainingSeats: config.remainingSeats,
      initialShareableSeats: config.initialShareableSeats,
      sourceExamGroupId: String(sched.examGroup._id),
      sourceExamType: sched.examGroup.examType,
      sourceSemester: sched.examGroup.semester,
      sourceDepartmentCodes: room.departments || [],
      scheduleId: String(sched._id),
    };

    for (const slot of slots) {
      if (
        normalizeDay(slot.date).toISOString() !==
        normalizeDay(sched.date).toISOString()
      ) {
        continue;
      }
      if (
        !timesOverlap(
          slot.startTime,
          slot.endTime,
          sched.startTime,
          sched.endTime
        )
      ) {
        continue;
      }
      bySlot[slotKeyOf(slot.date, slot.startTime, slot.endTime)].push(option);
    }
  }

  return bySlot;
};

// ────────────────────────────────────────────────────────────────
// Mutation — mark shareable / allocate / release
// ────────────────────────────────────────────────────────────────

const markRoomShareable = async ({
  examRoomId,
  initialShareableSeats,
  userId,
  session = null,
}) => {
  if (!examRoomId) throw new AppError("examRoomId is required", 400);
  if (!Number.isInteger(initialShareableSeats) || initialShareableSeats <= 0) {
    throw new AppError("initialShareableSeats must be a positive integer", 400);
  }

  const examRoom = await ExamRoom.findById(examRoomId).session(session || null);
  if (!examRoom) throw new AppError("ExamRoom not found", 404);

  const schedule = await ExamSchedule.findById(examRoom.schedule).session(
    session || null
  );
  if (!schedule) throw new AppError("ExamSchedule not found", 404);

  const sourceDepartmentCode = (examRoom.departments || [])[0] || "";

  // If a config already exists we bump the initial seats and treat remaining as
  // max(remaining, initial) so re-marking after an unmark cannot silently
  // shrink the pool below what consumers may already hold.
  const existing = await repo.findConfigByExamRoom(examRoomId, session);
  const remainingSeats = existing
    ? Math.max(existing.remainingSeats, initialShareableSeats)
    : initialShareableSeats;

  return repo.upsertConfig(
    {
      examRoom: examRoomId,
      sourceExamGroup: schedule.examGroup,
      sourceSchedule: schedule._id,
      sourceDepartmentCode,
      shareable: true,
      initialShareableSeats,
      remainingSeats,
      createdBy: userId,
    },
    session
  );
};

const unmarkRoomShareable = async ({ examRoomId, session = null }) => {
  const config = await repo.findConfigByExamRoom(examRoomId, session);
  if (!config) return null;

  const allocations = await repo.listAllocationsByConfig(config._id, session);
  if (allocations.length > 0) {
    throw new AppError(
      "Cannot unmark shareable: room has active shared seat allocations. Release them first.",
      409
    );
  }

  await repo.deleteConfigByExamRoom(examRoomId, session);
  return { unmarked: true };
};

/**
 * Consumer path: allocate N seats from an already-shareable ExamRoom.
 * Atomic — the $gte guard on the counter is the only serialisation point.
 */
const allocateSharedSeats = async ({
  examRoomId,
  consumerExamGroupId,
  consumerScheduleId,
  consumerDepartmentCode,
  studentsAllocated,
  session = null,
}) => {
  if (!Number.isInteger(studentsAllocated) || studentsAllocated <= 0) {
    throw new AppError("studentsAllocated must be a positive integer", 400);
  }

  const config = await repo.findConfigByExamRoom(examRoomId, session);
  if (!config || !config.shareable) {
    throw new AppError("Room is not marked shareable", 409);
  }

  const updated = await repo.decrementRemainingSeats(
    config._id,
    studentsAllocated,
    session
  );
  if (!updated) {
    throw new AppError(
      `Not enough shareable seats remaining in this room (requested ${studentsAllocated}, available ${config.remainingSeats})`,
      409
    );
  }

  const allocation = await repo.createAllocation(
    {
      sharingConfiguration: config._id,
      sourceExamRoom: examRoomId,
      sourceExamGroup: config.sourceExamGroup,
      consumerExamGroup: consumerExamGroupId,
      consumerSchedule: consumerScheduleId,
      consumerDepartmentCode,
      studentsAllocated,
    },
    session
  );

  // Reflect the consumer department in the source ExamRoom's `departments`
  // tag list so the source group's schedule/details views (and the invigilator
  // dashboards) show every department sitting in the room. Idempotent via
  // $addToSet, so repeat consumers from the same dept don't duplicate the tag.
  if (consumerDepartmentCode) {
    await ExamRoom.updateOne(
      { _id: examRoomId },
      { $addToSet: { departments: consumerDepartmentCode } },
      session ? { session } : undefined,
    );
  }

  return allocation;
};

/**
 * If no remaining allocation from `examRoomId` targets `deptCode`, remove that
 * dept from the source room's `departments` tag list. Owner dept is preserved
 * because it never appears as a consumer allocation.
 */
const pruneConsumerDeptIfUnused = async (examRoomId, deptCode, session) => {
  if (!deptCode) return;
  const stillUsed = await repo.listAllocationsBySourceExamRoom(examRoomId, session)
    .then((allocs) => allocs.some((a) => a.consumerDepartmentCode === deptCode));
  if (stillUsed) return;
  await ExamRoom.updateOne(
    { _id: examRoomId },
    { $pull: { departments: deptCode } },
    session ? { session } : undefined,
  );
};

const releaseSharedSeats = async ({ allocationId, session = null }) => {
  const allocation = await repo.findAllocationById(allocationId, session);
  if (!allocation) return null;

  await repo.incrementRemainingSeats(
    allocation.sharingConfiguration,
    allocation.studentsAllocated,
    session
  );
  await repo.deleteAllocationById(allocationId, session);
  await pruneConsumerDeptIfUnused(
    allocation.sourceExamRoom,
    allocation.consumerDepartmentCode,
    session,
  );
  return { released: true };
};

// ────────────────────────────────────────────────────────────────
// Cascade helpers — called from examDeletionService
// ────────────────────────────────────────────────────────────────

/**
 * The consumer group is going away. Restore seats to each source config the
 * consumer had drawn from.
 */
const releaseAllocationsByConsumerGroup = async ({
  consumerExamGroupId,
  session = null,
}) => {
  const allocations = await repo.listAllocationsByConsumerGroup(
    consumerExamGroupId,
    session
  );
  for (const alloc of allocations) {
    await repo.incrementRemainingSeats(
      alloc.sharingConfiguration,
      alloc.studentsAllocated,
      session
    );
  }
  await repo.deleteAllocationsByConsumerGroup(consumerExamGroupId, session);
  // After deletion, drop any consumer dept tags on the source rooms that no
  // longer have a live allocation from that dept. Dedup pairs first so we
  // don't touch the same room+dept twice.
  const touched = new Set();
  for (const alloc of allocations) {
    const key = `${alloc.sourceExamRoom}|${alloc.consumerDepartmentCode}`;
    if (touched.has(key)) continue;
    touched.add(key);
    await pruneConsumerDeptIfUnused(
      alloc.sourceExamRoom,
      alloc.consumerDepartmentCode,
      session,
    );
  }
  return { releasedAllocations: allocations.length };
};

/**
 * The source group is going away. Every config it owns dies; consumer
 * allocations pointing at those configs die too. No restore needed — the
 * source room is being removed, so nothing remains to restore into.
 */
const releaseAllocationsBySourceGroup = async ({
  sourceExamGroupId,
  session = null,
}) => {
  const allocations = await repo.listAllocationsBySourceGroup(
    sourceExamGroupId,
    session
  );
  await repo.deleteAllocationsBySourceGroup(sourceExamGroupId, session);
  const configResult = await repo.deleteConfigsBySourceGroup(
    sourceExamGroupId,
    session
  );
  return {
    releasedAllocations: allocations.length,
    deletedConfigs: configResult?.deletedCount || 0,
  };
};

/**
 * ExamRoom-scoped cascade helper: this specific room is being deleted, so its
 * config disappears and every allocation sourced from it dies (no restore —
 * the source room is gone).
 */
const releaseByExamRoomAsSource = async ({ examRoomId, session = null }) => {
  const config = await repo.findConfigByExamRoom(examRoomId, session);
  if (!config) return { deletedConfigs: 0, releasedAllocations: 0 };
  const allocations = await repo.listAllocationsByConfig(config._id, session);
  for (const alloc of allocations) {
    await repo.deleteAllocationById(alloc._id, session);
  }
  await repo.deleteConfigByExamRoom(examRoomId, session);
  return { deletedConfigs: 1, releasedAllocations: allocations.length };
};

/**
 * Consumer-schedule cascade helper: this schedule is being deleted, so every
 * allocation it drew from should be restored to the source config.
 */
const releaseByConsumerSchedule = async ({ consumerScheduleId, session = null }) => {
  const allocations = await repo.listAllocationsByConsumerSchedule(
    consumerScheduleId,
    session
  );
  for (const alloc of allocations) {
    await repo.incrementRemainingSeats(
      alloc.sharingConfiguration,
      alloc.studentsAllocated,
      session
    );
    await repo.deleteAllocationById(alloc._id, session);
  }
  const touched = new Set();
  for (const alloc of allocations) {
    const key = `${alloc.sourceExamRoom}|${alloc.consumerDepartmentCode}`;
    if (touched.has(key)) continue;
    touched.add(key);
    await pruneConsumerDeptIfUnused(
      alloc.sourceExamRoom,
      alloc.consumerDepartmentCode,
      session,
    );
  }
  return { releasedAllocations: allocations.length };
};

// ────────────────────────────────────────────────────────────────
// Read helpers for ExamDetails
// ────────────────────────────────────────────────────────────────

/**
 * Aggregate view for one ExamRoom: config + all consumer allocations.
 * Returns { config, allocations, occupiedByConsumers, status } where status is
 * one of: "not-shared" | "shareable" | "partially-shared" | "full".
 */
const getSharingStateForExamRoom = async (examRoomId, session = null) => {
  const config = await repo.findConfigByExamRoom(examRoomId, session);
  if (!config) {
    return {
      config: null,
      allocations: [],
      occupiedByConsumers: 0,
      status: "not-shared",
    };
  }

  const allocations = await repo.listAllocationsBySourceExamRoom(
    examRoomId,
    session
  );

  const occupiedByConsumers = allocations.reduce(
    (sum, a) => sum + a.studentsAllocated,
    0
  );

  let status = "shareable";
  if (config.remainingSeats === 0) status = "full";
  else if (occupiedByConsumers > 0) status = "partially-shared";

  return { config, allocations, occupiedByConsumers, status };
};

const getSharingStateForSchedule = async (scheduleId, session = null) => {
  const examRooms = await ExamRoom.find({ schedule: scheduleId });
  const roomIds = examRooms.map((r) => r._id);

  // Two batched queries for the whole schedule instead of two per room.
  const [configs, allocations] = await Promise.all([
    repo.findConfigsByExamRooms(roomIds, session),
    repo.listAllocationsBySourceExamRooms(roomIds, session),
  ]);
  const configByRoom = new Map(configs.map((c) => [String(c.examRoom), c]));
  const allocsByRoom = new Map();
  for (const a of allocations) {
    const key = String(a.sourceExamRoom);
    if (!allocsByRoom.has(key)) allocsByRoom.set(key, []);
    allocsByRoom.get(key).push(a);
  }

  const results = {};
  for (const room of examRooms) {
    const key = String(room._id);
    const config = configByRoom.get(key) || null;
    if (!config) {
      results[key] = {
        config: null,
        allocations: [],
        occupiedByConsumers: 0,
        status: "not-shared",
      };
      continue;
    }
    const roomAllocs = allocsByRoom.get(key) || [];
    const occupiedByConsumers = roomAllocs.reduce(
      (sum, a) => sum + a.studentsAllocated,
      0,
    );
    let status = "shareable";
    if (config.remainingSeats === 0) status = "full";
    else if (occupiedByConsumers > 0) status = "partially-shared";
    results[key] = { config, allocations: roomAllocs, occupiedByConsumers, status };
  }
  return results;
};

/**
 * Called by the finalize wiring BEFORE opening a transaction: sanity-check
 * every consumption row lines up with a live shareable config with enough
 * seats. Any failure surfaces a clean 409 before we start writing.
 */
const validateConsumptions = async (consumptions = []) => {
  for (const c of consumptions) {
    const config = await repo.findConfigByExamRoom(c.sourceExamRoomId);
    if (!config || !config.shareable) {
      throw new AppError(
        `Selected shared room is no longer available (examRoomId ${c.sourceExamRoomId})`,
        409
      );
    }
    if (config.remainingSeats < c.studentsAllocated) {
      throw new AppError(
        `Not enough shareable seats in the selected room (need ${c.studentsAllocated}, available ${config.remainingSeats})`,
        409
      );
    }
  }
};

module.exports = {
  findShareableRoomsForSlots,
  markRoomShareable,
  unmarkRoomShareable,
  allocateSharedSeats,
  releaseSharedSeats,
  releaseAllocationsByConsumerGroup,
  releaseAllocationsBySourceGroup,
  releaseByExamRoomAsSource,
  releaseByConsumerSchedule,
  getSharingStateForExamRoom,
  getSharingStateForSchedule,
  validateConsumptions,
};
