/**
 * "Behind on picking duties": below a role's target while an exam still has
 * open slots for that role. One rule, read by the select-your-duty nudge
 * (notification/reminder.jobs) and the ad level (ads.service). Pure — the
 * service (dutyCalculation.findSelectionShortfall) loads the progress rows and
 * open exam groups; these functions only decide.
 */

/**
 * teacherId → { roles: Set<role>, remaining } for every eligible teacher still
 * below a role's target. `remaining` sums the gap across those roles.
 */
const shortfallByTeacher = (progressRows) => {
  const short = new Map();
  for (const row of progressRows) {
    if (!row || !row.eligible || !(row.target > 0) || row.assigned >= row.target) continue;
    const id = String(row.teacherId);
    if (!short.has(id)) short.set(id, { roles: new Set(), remaining: 0 });
    short.get(id).roles.add(row.role);
    short.get(id).remaining += row.target - row.assigned;
  }
  return short;
};

/**
 * Roles with something left to pick in one exam group: a room no invigilator
 * (or no RS) holds yet, or an open DCS group.
 *   roomIds: the group's exam-room ids; filled: { invigilator: Set, rs: Set } of
 *   taken room ids; dcsOpen: whether any of its DCS groups is still open.
 */
const openRolesForGroup = ({ roomIds, filled, dcsOpen }) => {
  const roles = new Set();
  if (roomIds.some((id) => !filled.invigilator.has(id))) roles.add("invigilator");
  if (roomIds.some((id) => !filled.rs.has(id))) roles.add("rs");
  if (dcsOpen) roles.add("dcs");
  return roles;
};

/** Short in a role that one of the open exam groups still has room for. */
const isBehind = (shortEntry, openGroups) => {
  if (!shortEntry) return false;
  for (const { roles } of openGroups.values()) {
    if ([...shortEntry.roles].some((r) => roles.has(r))) return true;
  }
  return false;
};

module.exports = { shortfallByTeacher, openRolesForGroup, isBehind };
