/**
 * A "duty unit" is one teacher's duty in one exam slot: an invigilator room, or
 * a whole RS / DCS group. A teacher can hold only one duty per time slot
 * (`findTeacherConflict`), so teacher + schedule + role identifies it exactly.
 * Legacy duties with no schedule stand alone.
 *
 * Reminders, confirmations and calendar invites all work per unit — a 5-room
 * RS group is reminded, confirmed and invited once, never five times.
 */

const { buildRoomLabel } = require("../exam-cleanup/utils/examCleanupUtils");

const idOf = (v) => (v ? String(v._id || v) : null);

/** Stable key, e.g. `${scheduleId}|rs`. */
const unitKey = (d) => `${idOf(d.examSchedule) || idOf(d._id)}|${d.role}`;

/** Mongo filter matching every duty in `d`'s unit (any status). */
const unitFilter = (d) =>
  d.examSchedule
    ? { teacher: idOf(d.teacher), role: d.role, examSchedule: idOf(d.examSchedule) }
    : { _id: idOf(d._id) };

/** Group a flat duty list into units: Map<unitKey, Duty[]>. */
const groupIntoUnits = (duties) => {
  const units = new Map();
  for (const d of duties) {
    const k = `${idOf(d.teacher)}:${unitKey(d)}`;
    if (!units.has(k)) units.set(k, []);
    units.get(k).push(d);
  }
  return units;
};

/**
 * "Main Block — 101, 102; QA Academic Block — 004". Legacy duties with no
 * building fall back to their plain room label, listed first.
 */
const locationFor = (duties) => {
  const byBuilding = new Map();
  for (const d of duties) {
    const room = d.examRoom?.room;
    const building = room?.building?.name && room.roomNumber ? room.building.name : "";
    const label = building ? room.roomNumber : buildRoomLabel(d);
    if (!label) continue;
    if (!byBuilding.has(building)) byBuilding.set(building, []);
    byBuilding.get(building).push(label);
  }
  const numeric = (a, b) => a.localeCompare(b, undefined, { numeric: true });
  return [...byBuilding.entries()]
    .sort(([a], [b]) => numeric(a, b))
    .map(([name, rooms]) => {
      const list = rooms.sort(numeric).join(", ");
      return name ? `${name} — ${list}` : list;
    })
    .join("; ");
};

module.exports = { idOf, unitKey, unitFilter, groupIntoUnits, locationFor };
