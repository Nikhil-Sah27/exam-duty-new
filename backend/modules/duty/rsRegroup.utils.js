// RS regrouping after a shared SEE slot's rooms changed — pure (no I/O); the
// duty service applies the result (duty.service.syncRsGroupsForSchedule).
//
// RS groups are derived — every building's rooms in room-number order, chunks
// of 5 (shared/utils/roomOrder.js, same as the app) — so adding or removing
// rooms re-forms them. Each RS keeps the chunk holding most of their rooms
// (ties → earlier chunk, then whoever claimed first) and is given the rest of
// it; their rooms that landed in another chunk go to that chunk's RS. An RS
// left without a chunk (fewer groups are needed now) is released.

const idOf = (v) => (v ? String(v._id || v) : null);

/**
 * chunks        ExamRoom[][] from chunkRsGroups (room.roomNumber populated)
 * live          the schedule's live RS duties, in creation order
 * removedDuties RS duties just cancelled on deleted rooms (to tell their holders)
 *
 * Returns { chunkOfOwner, toCancel, toCreate, changes }: duty ids to cancel,
 * { teacher, examRoom } duties to create, owner teacher → chunk index, and per
 * affected teacher { added, removed, template } (template = one live duty of
 * theirs, whose standing new duties copy).
 */
function planRsRegroup({ chunks, live, removedDuties = [] }) {
  const chunkOfRoom = new Map();
  chunks.forEach((chunk, ci) => chunk.forEach((er) => chunkOfRoom.set(String(er._id), ci)));
  const dutyByRoom = new Map(live.map((d) => [String(d.examRoom), d]));

  const firstSeen = new Map();
  live.forEach((d, i) => {
    if (!firstSeen.has(idOf(d.teacher))) firstSeen.set(idOf(d.teacher), i);
  });
  const candidates = [];
  chunks.forEach((chunk, ci) => {
    const counts = new Map();
    for (const er of chunk) {
      const d = dutyByRoom.get(String(er._id));
      if (d) counts.set(idOf(d.teacher), (counts.get(idOf(d.teacher)) || 0) + 1);
    }
    for (const [teacher, count] of counts) candidates.push({ ci, teacher, count });
  });
  candidates.sort(
    (a, b) => b.count - a.count || a.ci - b.ci || firstSeen.get(a.teacher) - firstSeen.get(b.teacher),
  );
  const ownerOfChunk = new Map();
  const chunkOfOwner = new Map();
  for (const { ci, teacher } of candidates) {
    if (ownerOfChunk.has(ci) || chunkOfOwner.has(teacher)) continue;
    ownerOfChunk.set(ci, teacher);
    chunkOfOwner.set(teacher, ci);
  }

  const changes = new Map();
  const changeFor = (teacher) => {
    if (!changes.has(teacher)) changes.set(teacher, { added: [], removed: [], template: null });
    return changes.get(teacher);
  };
  for (const d of live) changeFor(idOf(d.teacher)).template ||= d;
  for (const d of removedDuties) {
    if (d.role === "rs") changeFor(idOf(d.teacher)).removed.push(d.room);
  }

  const toCancel = [];
  for (const d of live) {
    const teacher = idOf(d.teacher);
    if (chunkOfOwner.get(teacher) !== chunkOfRoom.get(String(d.examRoom))) {
      toCancel.push(d._id);
      changeFor(teacher).removed.push(d.room);
    }
  }
  const toCreate = [];
  for (const [ci, teacher] of ownerOfChunk) {
    for (const er of chunks[ci]) {
      const d = dutyByRoom.get(String(er._id));
      if (d && idOf(d.teacher) === teacher) continue;
      toCreate.push({ teacher, examRoom: er });
      changeFor(teacher).added.push(er.room?.roomNumber || "");
    }
  }
  for (const c of changes.values()) {
    c.added = c.added.filter(Boolean);
    c.removed = c.removed.filter(Boolean);
  }
  return { chunkOfOwner, toCancel, toCreate, changes };
}

module.exports = { planRsRegroup };
