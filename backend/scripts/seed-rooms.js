// Hard-wipe + reseed the Buildings/Rooms infrastructure to mirror a realistic
// BMSIT&M campus layout, scoped to three blocks the college actually uses
// for exam halls: Academic, Lab, and BSN (Basic Sciences). Run with:
//   node backend/scripts/seed-rooms.js
//
// Layout constraints from the spec:
//   • ≥ 3 blocks (we have 3)
//   • ≥ 4 floors per block
//   • ≥ 10 rooms per floor
// Room numbers follow <floor><nn> (101 = 1st floor, room 01). The building
// name carries the campus-block context — no prefix on the room number.

const mongoose = require("mongoose");
require("dotenv").config();

const Building = require("../modules/infrastructure/building.model");
const Room = require("../modules/infrastructure/infrastructure.model");

// Per-floor descriptor: an array of room capacities. Capacities vary
// realistically so the data isn't synthetic-looking. Lecture halls in
// academic blocks seat more; labs seat fewer.
const academicFloor = () => [72, 72, 60, 60, 60, 60, 48, 48, 48, 48, 48, 36];
const labFloor      = () => [36, 36, 36, 36, 30, 30, 30, 30, 24, 24];
const bsnFloor      = () => [60, 60, 60, 60, 48, 48, 48, 48, 48, 36];

const BUILDINGS = [
  {
    name: "Academic Block",
    // 5 floors (Ground + 1..4), 12 rooms each = 60 rooms.
    floors: [0, 1, 2, 3, 4].map((floor) => ({
      floor,
      capacities: academicFloor(),
    })),
  },
  {
    name: "Lab Block",
    // 4 floors (Ground + 1..3), 10 rooms each = 40 rooms.
    floors: [0, 1, 2, 3].map((floor) => ({
      floor,
      capacities: labFloor(),
    })),
  },
  {
    name: "BSN Block",
    // 4 floors (Ground + 1..3), 10 rooms each = 40 rooms.
    floors: [0, 1, 2, 3].map((floor) => ({
      floor,
      capacities: bsnFloor(),
    })),
  },
];

const roomNumber = (floor, idx) =>
  `${floor}${(idx + 1).toString().padStart(2, "0")}`;

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const college = await require("../shared/tenancy/script").useCollegeForScript();
  console.log("Connected to MongoDB");

  // 1. Hard-wipe existing infrastructure
  const wipeRooms = await Room.deleteMany({});
  const wipeBuildings = await Building.deleteMany({});
  console.log(
    `Wiped ${wipeRooms.deletedCount} rooms, ${wipeBuildings.deletedCount} buildings`,
  );

  // 2. Insert buildings
  const buildings = await Building.insertMany(
    BUILDINGS.map((b) => ({ name: b.name })),
  );
  const buildingByName = new Map(buildings.map((b) => [b.name, b]));
  console.log(`Inserted ${buildings.length} buildings`);

  // 3. Insert rooms
  const roomDocs = [];
  for (const b of BUILDINGS) {
    const building = buildingByName.get(b.name);
    for (const f of b.floors) {
      f.capacities.forEach((capacity, idx) => {
        roomDocs.push({
          roomNumber: roomNumber(f.floor, idx),
          building: building._id,
          floor: f.floor,
          capacity,
        });
      });
    }
  }
  const rooms = await Room.insertMany(roomDocs);
  console.log(`Inserted ${rooms.length} rooms`);

  // 4. Summary
  console.log("\nCampus summary:");
  for (const b of BUILDINGS) {
    const total = b.floors.reduce((a, f) => a + f.capacities.length, 0);
    const seats = b.floors.reduce(
      (a, f) => a + f.capacities.reduce((x, y) => x + y, 0),
      0,
    );
    console.log(
      `  ${b.name.padEnd(18)} floors=${b.floors.length}  rooms=${String(total).padStart(2)}  seats=${seats}`,
    );
  }
  const grandSeats = roomDocs.reduce((a, r) => a + r.capacity, 0);
  console.log(
    `  ${"TOTAL".padEnd(18)} buildings=${BUILDINGS.length}  rooms=${roomDocs.length}  seats=${grandSeats}`,
  );

  await mongoose.disconnect();
  console.log("\nDone");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
