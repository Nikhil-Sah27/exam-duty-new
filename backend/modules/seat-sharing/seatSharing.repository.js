const RoomSharingConfiguration = require("./roomSharingConfiguration.model");
const SharedSeatAllocation = require("./sharedSeatAllocation.model");

const sessionOpt = (session) => (session ? { session } : {});

// ── RoomSharingConfiguration ─────────────────────────────────────────

const findConfigByExamRoom = (examRoomId, session = null) =>
  RoomSharingConfiguration.findOne({ examRoom: examRoomId }, null, sessionOpt(session));

const findConfigsByExamRooms = (examRoomIds, session = null) =>
  RoomSharingConfiguration.find(
    { examRoom: { $in: examRoomIds } },
    null,
    sessionOpt(session),
  );

const findConfigById = (id, session = null) =>
  RoomSharingConfiguration.findById(id, null, sessionOpt(session));

const listActiveConfigsForSchedules = (scheduleIds, session = null) =>
  RoomSharingConfiguration.find(
    {
      sourceSchedule: { $in: scheduleIds },
      shareable: true,
      remainingSeats: { $gt: 0 },
    },
    null,
    sessionOpt(session)
  );

const upsertConfig = (data, session = null) =>
  RoomSharingConfiguration.findOneAndUpdate(
    { examRoom: data.examRoom },
    { $set: data },
    { new: true, upsert: true, ...sessionOpt(session) }
  );

const deleteConfigByExamRoom = (examRoomId, session = null) =>
  RoomSharingConfiguration.deleteOne({ examRoom: examRoomId }, sessionOpt(session));

const deleteConfigsBySourceGroup = (sourceExamGroupId, session = null) =>
  RoomSharingConfiguration.deleteMany(
    { sourceExamGroup: sourceExamGroupId },
    sessionOpt(session)
  );

// Atomic decrement guarded by $gte so concurrent consumers can't over-draw.
// Returns the updated doc, or null if the guard failed.
const decrementRemainingSeats = (configId, amount, session = null) =>
  RoomSharingConfiguration.findOneAndUpdate(
    { _id: configId, remainingSeats: { $gte: amount } },
    { $inc: { remainingSeats: -amount } },
    { new: true, ...sessionOpt(session) }
  );

const incrementRemainingSeats = (configId, amount, session = null) =>
  RoomSharingConfiguration.findByIdAndUpdate(
    configId,
    { $inc: { remainingSeats: amount } },
    { new: true, ...sessionOpt(session) }
  );

// ── SharedSeatAllocation ─────────────────────────────────────────────

const createAllocation = (data, session = null) =>
  SharedSeatAllocation.create([data], sessionOpt(session)).then((docs) => docs[0]);

const findAllocationById = (id, session = null) =>
  SharedSeatAllocation.findById(id, null, sessionOpt(session));

const listAllocationsByConfig = (configId, session = null) =>
  SharedSeatAllocation.find({ sharingConfiguration: configId }, null, sessionOpt(session));

const listAllocationsBySourceExamRoom = (examRoomId, session = null) =>
  SharedSeatAllocation.find({ sourceExamRoom: examRoomId }, null, sessionOpt(session));

const listAllocationsBySourceExamRooms = (examRoomIds, session = null) =>
  SharedSeatAllocation.find(
    { sourceExamRoom: { $in: examRoomIds } },
    null,
    sessionOpt(session),
  );

const listAllocationsByConsumerSchedule = (scheduleId, session = null) =>
  SharedSeatAllocation.find({ consumerSchedule: scheduleId }, null, sessionOpt(session));

const listAllocationsByConsumerGroup = (consumerExamGroupId, session = null) =>
  SharedSeatAllocation.find({ consumerExamGroup: consumerExamGroupId }, null, sessionOpt(session));

const listAllocationsBySourceGroup = (sourceExamGroupId, session = null) =>
  SharedSeatAllocation.find({ sourceExamGroup: sourceExamGroupId }, null, sessionOpt(session));

const deleteAllocationById = (id, session = null) =>
  SharedSeatAllocation.findByIdAndDelete(id, sessionOpt(session));

const deleteAllocationsByConsumerGroup = (consumerExamGroupId, session = null) =>
  SharedSeatAllocation.deleteMany(
    { consumerExamGroup: consumerExamGroupId },
    sessionOpt(session)
  );

const deleteAllocationsBySourceGroup = (sourceExamGroupId, session = null) =>
  SharedSeatAllocation.deleteMany(
    { sourceExamGroup: sourceExamGroupId },
    sessionOpt(session)
  );

module.exports = {
  findConfigByExamRoom,
  findConfigsByExamRooms,
  findConfigById,
  listActiveConfigsForSchedules,
  upsertConfig,
  deleteConfigByExamRoom,
  deleteConfigsBySourceGroup,
  decrementRemainingSeats,
  incrementRemainingSeats,
  createAllocation,
  findAllocationById,
  listAllocationsByConfig,
  listAllocationsBySourceExamRoom,
  listAllocationsBySourceExamRooms,
  listAllocationsByConsumerSchedule,
  listAllocationsByConsumerGroup,
  listAllocationsBySourceGroup,
  deleteAllocationById,
  deleteAllocationsByConsumerGroup,
  deleteAllocationsBySourceGroup,
};
