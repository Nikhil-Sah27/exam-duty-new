/**
 * Pure helpers for DCS sizing and class distribution. No side effects, no I/O —
 * the service layer (and frontend, via parallel TS copies) consume them. The
 * formulas are spec-locked:
 *
 *   N      = ceil(totalStudents / 300)
 *   base   = floor(totalRooms / N)
 *   extras = totalRooms - base * N    → handed out one-by-one to groups 1..extras
 */

/** ceil(totalStudents / 300). Zero or negative input → 0 (nothing to staff). */
function calculateRequiredDCS(totalStudents) {
  const n = Number(totalStudents) || 0;
  if (n <= 0) return 0;
  return Math.ceil(n / 300);
}

/**
 * Distribute an ordered list of rooms into `requiredDCS` chunks. Extra rooms
 * (when totalRooms doesn't divide evenly) are appended one-per-group starting
 * from index 0 — per the spec's "DCS 1 → 7 classes, DCS 2..4 → 6 classes" rule.
 *
 * Returns `requiredDCS` arrays. If there are fewer rooms than groups, trailing
 * groups receive an empty array — the service layer decides whether to drop
 * them or keep them as visible "no-class" slots. (We keep them: the spec wants
 * the DCS count to come from the student formula, not the room count.)
 */
function distributeClasses(rooms, requiredDCS) {
  const list = Array.isArray(rooms) ? rooms.slice() : [];
  const groups = Math.max(0, Math.floor(requiredDCS) || 0);
  if (groups === 0) return [];

  const base = Math.floor(list.length / groups);
  const remainder = list.length - base * groups;

  const result = [];
  let cursor = 0;
  for (let i = 0; i < groups; i++) {
    const take = base + (i < remainder ? 1 : 0);
    result.push(list.slice(cursor, cursor + take));
    cursor += take;
  }
  return result;
}

// Hand `count` rooms out one at a time to whichever group is smallest (ties →
// earlier group), so sizes stay balanced. Returns how many each group gets.
function fillQuotas(sizes, count) {
  const quotas = sizes.map(() => 0);
  for (let k = 0; k < count; k++) {
    let best = 0;
    for (let i = 1; i < sizes.length; i++) {
      if (sizes[i] + quotas[i] < sizes[best] + quotas[best]) best = i;
    }
    quotas[best] += 1;
  }
  return quotas;
}

/**
 * Lay out one schedule's DCS groups for the rooms it has now (pure — the
 * service writes the result; see dcsGroup.service.syncGroupsForSchedule).
 *
 *   rooms     ExamRooms, already in room-number order
 *   existing  the schedule's DCSGroup docs
 *   required  ceil(students / 300) for the whole slot
 *
 * Nobody holding a group → laid out from scratch (identical to creating every
 * department together). Otherwise each held group keeps its surviving rooms and
 * the rest are topped up, smallest group first, across max(required, held)
 * groups — new rooms go INTO held groups rather than needing more DCS.
 *
 * Returns { plan, emptied, reusable }: `plan` is every final group in index
 * order ({ held: { doc, rooms } | null, groupIndex, rooms: ids, added: rooms });
 * `emptied` are held groups whose rooms are all gone (to release); `reusable`
 * are non-held docs, by index, to re-use for the open groups (rest = surplus).
 */
function planGroupLayout({ rooms, existing, required }) {
  const live = new Set(rooms.map((r) => String(r._id)));
  const held = [];
  const reusable = [];
  const emptied = [];
  for (const g of existing) {
    const kept = (g.assignedRooms || []).filter((id) => live.has(String(id)));
    if (g.status === "claimed" && kept.length > 0) held.push({ doc: g, rooms: kept });
    else {
      if (g.status === "claimed") emptied.push(g);
      reusable.push(g);
    }
  }
  reusable.sort((a, b) => a.groupIndex - b.groupIndex);

  const heldIndices = new Set(held.map((h) => h.doc.groupIndex));
  const openCount = held.length === 0 ? required : Math.max(required, held.length) - held.length;
  const freeIndices = [];
  for (let i = 1; freeIndices.length < openCount; i++) {
    if (!heldIndices.has(i)) freeIndices.push(i);
  }
  const plan = [
    ...held.map((h) => ({ held: h, groupIndex: h.doc.groupIndex, rooms: h.rooms, added: [] })),
    ...freeIndices.map((groupIndex) => ({ held: null, groupIndex, rooms: [], added: [] })),
  ].sort((a, b) => a.groupIndex - b.groupIndex);

  if (held.length === 0) {
    const buckets = distributeClasses(rooms, plan.length);
    plan.forEach((p, i) => {
      p.rooms = buckets[i].map((r) => r._id);
    });
  } else {
    const covered = new Set(held.flatMap((h) => h.rooms.map(String)));
    const pool = rooms.filter((r) => !covered.has(String(r._id)));
    const quotas = fillQuotas(plan.map((p) => p.rooms.length), pool.length);
    let cursor = 0;
    plan.forEach((p, i) => {
      p.added = pool.slice(cursor, cursor + quotas[i]);
      p.rooms = [...p.rooms, ...p.added.map((r) => r._id)];
      cursor += quotas[i];
    });
  }
  return { plan, emptied, reusable };
}

module.exports = { calculateRequiredDCS, distributeClasses, fillQuotas, planGroupLayout };
