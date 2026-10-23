const Building = require("./building.model");
const Room = require("./infrastructure.model");

// ---------- Building ----------

const createBuilding = (data) => Building.create(data);

const findAllBuildings = () => Building.find({ isActive: true }).sort({ name: 1 });

const findBuildingById = (id) => Building.findById(id);

const deleteBuilding = (id) => Building.findByIdAndDelete(id);

const deleteRoomsByBuilding = (buildingId) =>
  Room.deleteMany({ building: buildingId });

const countRoomsByBuilding = (buildingId) =>
  Room.countDocuments({ building: buildingId, isActive: true });

const getFloorsByBuilding = async (buildingId) => {
  const result = await Room.distinct("floor", { building: buildingId, isActive: true });
  return result.length;
};

// ---------- Room ----------

const createRoom = (data) => Room.create(data);

const createRoomsBulk = (roomsArray) =>
  Room.insertMany(roomsArray, { ordered: false });

const findExistingRoomNumbers = (buildingId, roomNumbers) =>
  Room.find({ building: buildingId, roomNumber: { $in: roomNumbers } }).select(
    "roomNumber"
  );

const findRoomsByBuilding = (buildingId) =>
  Room.find({ building: buildingId, isActive: true }).sort({ floor: 1, roomNumber: 1 });

// All active rooms across every building, building name populated — used by
// the Create-Exams room picker to group rooms by building → floor.
const findAllActiveRoomsPopulated = () =>
  Room.find({ isActive: true })
    .populate("building", "name")
    .sort({ floor: 1, roomNumber: 1 });

const findRoomById = (id) => Room.findById(id);

const updateRoom = (id, data) => Room.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const deleteRoom = (id) => Room.findByIdAndDelete(id);

module.exports = {
  createBuilding,
  findAllBuildings,
  findBuildingById,
  deleteBuilding,
  deleteRoomsByBuilding,
  countRoomsByBuilding,
  getFloorsByBuilding,
  createRoom,
  createRoomsBulk,
  findExistingRoomNumbers,
  findRoomsByBuilding,
  findAllActiveRoomsPopulated,
  findRoomById,
  updateRoom,
  deleteRoom,
};
