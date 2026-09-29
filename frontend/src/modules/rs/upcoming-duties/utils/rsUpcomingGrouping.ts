import type { Duty } from "@/modules/duties/types";
import { compareRoomNumbers } from "@/modules/rs/select-duty/utils/rsDutyGroupingUtils";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";

/**
 * Aggregate the RS user's individual room duties back into the "room group"
 * they were selected as on the Select Duty page.
 *
 * Partition key is the same as select-duty:
 *   examGroupId | scheduleId | date | startTime | endTime | buildingId
 *
 * Inside each partition we sort by room number and chunk by 5 — RS always
 * selects a full group at a time, so their duties in a partition always
 * align to that chunking (proven by construction: any subset of complete
 * chunk-of-5s, when re-chunked by 5, produces the same partitioning).
 */

const GROUP_SIZE = 5;

export interface RSUpcomingRoom {
  dutyId: string;
  duty: Duty;
  roomNumber: string;
  roomId: string;
  floor?: number;
  capacity?: number;
  departments: string[];
}

export interface RSUpcomingGroup {
  /** Deterministic id: `${scheduleId}:${buildingId}:${chunkIndex}` */
  groupId: string;
  scheduleId: string;
  examGroupId: string;
  examType: string;
  semester: number | string;
  date: string;
  startTime: string;
  endTime: string;
  buildingId: string;
  buildingName: string;
  chunkIndex: number;
  rooms: RSUpcomingRoom[];
  departments: string[];
  /** "Rooms 004–412" — first to last room number. */
  rangeLabel: string;
}

export interface RSUpcomingTimeSlot {
  startTime: string;
  endTime: string;
  groups: RSUpcomingGroup[];
}

export interface RSUpcomingDateGroup {
  /** ISO YYYY-MM-DD */
  dateKey: string;
  /** First duty's full date string — preserved so consumers can format it. */
  date: string;
  timeSlots: RSUpcomingTimeSlot[];
  /** Sum of rooms across all groups on this date. */
  totalRooms: number;
  /** Number of groups on this date. */
  totalGroups: number;
}

export interface RSUpcomingSummary {
  dateGroups: RSUpcomingDateGroup[];
  totalGroups: number;
  totalRooms: number;
  totalDays: number;
}

/**
 * "Upcoming" = assigned duty whose end time hasn't passed yet (a duty that
 * finished earlier today drops off into Completed). Cancelled duties excluded.
 */
export function filterUpcomingRSDuties(duties: readonly Duty[]): Duty[] {
  return duties.filter(
    (d) => d.status === "assigned" && isDutyUpcoming(d.date, d.endTime),
  );
}

function partitionKey(d: Duty): string | null {
  const examGroupId = d.examSchedule?.examGroup?._id;
  const scheduleId = d.examSchedule?._id;
  const buildingId = d.examRoom?.room?.building?._id;
  const date = new Date(d.date).toISOString().slice(0, 10);
  if (!examGroupId || !scheduleId || !buildingId) return null;
  return [
    examGroupId,
    scheduleId,
    date,
    d.startTime,
    d.endTime,
    buildingId,
  ].join("|");
}

function toRoom(duty: Duty): RSUpcomingRoom {
  const r = duty.examRoom?.room;
  return {
    dutyId: duty._id,
    duty,
    roomNumber: r?.roomNumber || duty.room || "—",
    roomId: r?._id || "",
    floor: r?.floor,
    capacity: r?.capacity,
    departments: duty.examRoom?.departments ?? [],
  };
}

function unionDepartments(rooms: readonly RSUpcomingRoom[]): string[] {
  const set = new Set<string>();
  for (const r of rooms) {
    for (const d of r.departments) set.add(d.toUpperCase());
  }
  return [...set].sort();
}

function buildRangeLabel(rooms: readonly RSUpcomingRoom[]): string {
  if (rooms.length === 0) return "";
  if (rooms.length === 1) return `Room ${rooms[0].roomNumber}`;
  const first = rooms[0].roomNumber;
  const last = rooms[rooms.length - 1].roomNumber;
  return `Rooms ${first}–${last}`;
}

/**
 * Turn the RS user's flat duty list into contiguous room-group cards.
 * Duties without full examSchedule/examRoom population (legacy shape) are
 * passed through as single-room groups so nothing is silently dropped.
 */
export function groupRSDutiesIntoUpcomingGroups(
  duties: readonly Duty[],
): RSUpcomingGroup[] {
  const partitions = new Map<string, Duty[]>();
  const orphans: Duty[] = [];

  for (const d of duties) {
    const key = partitionKey(d);
    if (!key) {
      orphans.push(d);
      continue;
    }
    const bucket = partitions.get(key);
    if (bucket) bucket.push(d);
    else partitions.set(key, [d]);
  }

  const groups: RSUpcomingGroup[] = [];

  for (const bucket of partitions.values()) {
    const rooms = bucket
      .map(toRoom)
      .sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));

    const first = bucket[0];
    const scheduleId = first.examSchedule!._id;
    const examGroupId = first.examSchedule!.examGroup!._id;
    const buildingId = first.examRoom!.room!.building!._id;
    const buildingName = first.examRoom!.room!.building!.name || "—";
    const examType = String(first.examSchedule?.examGroup?.examType ?? "");
    const semester = first.examSchedule?.examGroup?.semester ?? "—";

    for (let i = 0; i < rooms.length; i += GROUP_SIZE) {
      const chunk = rooms.slice(i, i + GROUP_SIZE);
      const chunkIndex = Math.floor(i / GROUP_SIZE);
      groups.push({
        groupId: `${scheduleId}:${buildingId}:${chunkIndex}`,
        scheduleId,
        examGroupId,
        examType,
        semester,
        date: first.date,
        startTime: first.startTime,
        endTime: first.endTime,
        buildingId,
        buildingName,
        chunkIndex,
        rooms: chunk,
        departments: unionDepartments(chunk),
        rangeLabel: buildRangeLabel(chunk),
      });
    }
  }

  // Legacy / broken duties: one group per duty so they still surface.
  for (const d of orphans) {
    const room = toRoom(d);
    groups.push({
      groupId: `legacy:${d._id}`,
      scheduleId: d.examSchedule?._id ?? d.exam?._id ?? d._id,
      examGroupId: d.examSchedule?.examGroup?._id ?? d.exam?._id ?? "",
      examType: String(d.examSchedule?.examGroup?.examType ?? d.exam?.type ?? ""),
      semester: d.examSchedule?.examGroup?.semester ?? d.exam?.semester ?? "—",
      date: d.date,
      startTime: d.startTime,
      endTime: d.endTime,
      buildingId: "",
      buildingName: d.examRoom?.room?.building?.name || "—",
      chunkIndex: 0,
      rooms: [room],
      departments: unionDepartments([room]),
      rangeLabel: buildRangeLabel([room]),
    });
  }

  groups.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    if (a.buildingName !== b.buildingName) {
      return a.buildingName.localeCompare(b.buildingName);
    }
    return a.chunkIndex - b.chunkIndex;
  });

  return groups;
}

/** Nest groups under date → time slot for the page's outline. */
export function buildRSUpcomingSummary(
  groups: readonly RSUpcomingGroup[],
): RSUpcomingSummary {
  const byDate = new Map<string, RSUpcomingGroup[]>();
  for (const g of groups) {
    const key = new Date(g.date).toISOString().slice(0, 10);
    const bucket = byDate.get(key);
    if (bucket) bucket.push(g);
    else byDate.set(key, [g]);
  }

  const dateGroups: RSUpcomingDateGroup[] = [];
  let totalRooms = 0;

  for (const [dateKey, list] of byDate) {
    const bySlot = new Map<string, RSUpcomingTimeSlot>();
    for (const g of list) {
      const slotKey = `${g.startTime}-${g.endTime}`;
      const existing = bySlot.get(slotKey);
      if (existing) {
        existing.groups.push(g);
      } else {
        bySlot.set(slotKey, {
          startTime: g.startTime,
          endTime: g.endTime,
          groups: [g],
        });
      }
    }
    const timeSlots = [...bySlot.values()];
    const rooms = list.reduce((sum, g) => sum + g.rooms.length, 0);
    totalRooms += rooms;
    dateGroups.push({
      dateKey,
      date: list[0].date,
      timeSlots,
      totalRooms: rooms,
      totalGroups: list.length,
    });
  }

  return {
    dateGroups,
    totalGroups: groups.length,
    totalRooms,
    totalDays: dateGroups.length,
  };
}
