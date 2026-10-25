// Room ordering + RS chunking, shared by the DCS and RS group logic. Must stay
// identical to the client's grouping (frontend/src/modules/rs/select-duty/
// utils/rsDutyGroupingUtils.ts and its mobile copy): if the server chunked
// rooms differently, it would hand an RS a different group than the one the
// app shows them.

const NUMERIC_PREFIX_RE = /^(\d+)/;

/**
 * Sort by leading-numeric portion of the room number, then by the full string
 * as a tiebreaker.
 */
const compareRoomNumbers = (a, b) => {
  const am = a.match(NUMERIC_PREFIX_RE);
  const bm = b.match(NUMERIC_PREFIX_RE);
  if (am && bm) {
    const an = Number(am[1]);
    const bn = Number(bm[1]);
    if (an !== bn) return an - bn;
  } else if (am) {
    return -1;
  } else if (bm) {
    return 1;
  }
  return a.localeCompare(b);
};

const RS_GROUP_SIZE = 5;

/**
 * One schedule's ExamRooms (with `room.building` + `room.roomNumber`
 * populated) → RS groups: per building, sorted by room number, chunks of 5.
 */
const chunkRsGroups = (examRooms, size = RS_GROUP_SIZE) => {
  const byBuilding = new Map();
  for (const er of examRooms) {
    const key = String(er.room?.building?._id || er.room?.building || "");
    if (!byBuilding.has(key)) byBuilding.set(key, []);
    byBuilding.get(key).push(er);
  }
  const chunks = [];
  for (const rooms of byBuilding.values()) {
    rooms.sort((a, b) => compareRoomNumbers(a.room?.roomNumber || "", b.room?.roomNumber || ""));
    for (let i = 0; i < rooms.length; i += size) chunks.push(rooms.slice(i, i + size));
  }
  return chunks;
};

module.exports = { compareRoomNumbers, chunkRsGroups, RS_GROUP_SIZE };
