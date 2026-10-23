const AppError = require("../../shared/utils/AppError");
const repo = require("./infrastructure.repository");

// ---------- Building ----------

const createBuilding = async ({ name }) => {
  return repo.createBuilding({ name });
};

const getAllBuildings = async () => {
  const buildings = await repo.findAllBuildings();

  const result = await Promise.all(
    buildings.map(async (b) => {
      const [totalRooms, totalFloors] = await Promise.all([
        repo.countRoomsByBuilding(b._id),
        repo.getFloorsByBuilding(b._id),
      ]);
      return {
        _id: b._id,
        name: b.name,
        isActive: b.isActive,
        createdAt: b.createdAt,
        totalRooms,
        totalFloors,
      };
    })
  );

  return result;
};

const deleteBuilding = async (id) => {
  const building = await repo.findBuildingById(id);
  if (!building) throw new AppError("Building not found", 404);
  await repo.deleteRoomsByBuilding(id);
  await repo.deleteBuilding(id);
};

// ---------- Room ----------

const getRoomsByBuilding = async (buildingId) => {
  const building = await repo.findBuildingById(buildingId);
  if (!building) throw new AppError("Building not found", 404);
  return repo.findRoomsByBuilding(buildingId);
};

const createRoom = async ({ roomNumber, building, floor, capacity }) => {
  const bldg = await repo.findBuildingById(building);
  if (!bldg) throw new AppError("Building not found", 404);
  return repo.createRoom({ roomNumber, building, floor, capacity });
};

const createRoomsBulk = async (building, rooms) => {
  const bldg = await repo.findBuildingById(building);
  if (!bldg) throw new AppError("Building not found", 404);

  const roomNumbers = rooms.map((r) => r.roomNumber);

  // Find which room numbers already exist
  const existing = await repo.findExistingRoomNumbers(building, roomNumbers);
  const existingSet = new Set(existing.map((r) => r.roomNumber));

  // Filter to only new rooms
  const newRooms = rooms
    .filter((r) => !existingSet.has(r.roomNumber))
    .map((r) => ({ ...r, building }));

  if (newRooms.length === 0) {
    return {
      created: [],
      skipped: [...existingSet],
    };
  }

  const created = await repo.createRoomsBulk(newRooms);
  return {
    created,
    skipped: [...existingSet],
  };
};

const updateRoom = async (id, { capacity }) => {
  const room = await repo.findRoomById(id);
  if (!room) throw new AppError("Room not found", 404);
  return repo.updateRoom(id, { capacity });
};

const deleteRoom = async (id) => {
  const room = await repo.findRoomById(id);
  if (!room) throw new AppError("Room not found", 404);
  await repo.deleteRoom(id);
};

// ---------- Raw reads (used by create-exams room picker) ----------
// getAllBuildings enriches each building with room/floor counts; these return
// the plain records other domains need without that overhead.

const listActiveBuildings = () => repo.findAllBuildings();

const listAllActiveRoomsPopulated = () => repo.findAllActiveRoomsPopulated();

module.exports = {
  createBuilding,
  getAllBuildings,
  deleteBuilding,
  getRoomsByBuilding,
  createRoom,
  createRoomsBulk,
  updateRoom,
  deleteRoom,
  listActiveBuildings,
  listAllActiveRoomsPopulated,
};
