import type { ExamGroup, ExamGroupStatus, Duty } from "../types/exam.types";

export function getExamGroupStatus(group: ExamGroup): ExamGroupStatus {
  const now = new Date();
  const start = new Date(group.startDate);
  const end = new Date(group.endDate);
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (now < start) return "upcoming";
  if (now > end) return "completed";
  return "ongoing";
}

const STATUS_STYLES: Record<ExamGroupStatus, { bg: string; text: string; dot: string }> = {
  upcoming: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  ongoing: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  completed: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
};

export function getStatusStyle(status: ExamGroupStatus) {
  return STATUS_STYLES[status];
}

const TYPE_COLORS: Record<string, string> = {
  IA1: "bg-violet-600",
  IA2: "bg-indigo-600",
  IA3: "bg-cyan-600",
  SEE: "bg-gradient-to-br from-pink-500 to-purple-600",
};

export function getTypeColor(examType: string): string {
  return TYPE_COLORS[examType] || "bg-gray-800";
}

const TYPE_SUBTITLE: Record<string, string> = {
  IA1: "Internal Assessment 1",
  IA2: "Internal Assessment 2",
  IA3: "Internal Assessment 3",
  SEE: "Semester End Examination",
};

export function getTypeSubtitle(examType: string): string {
  return TYPE_SUBTITLE[examType] || examType;
}

/**
 * Match a duty against a target room using the room's ObjectId when either
 * side exposes it (`examRoom.room._id`). Falls back to the legacy string
 * comparison only when neither side has an id — the string form is a bare
 * room number and would falsely collide across buildings.
 */
function dutyMatchesRoom(d: Duty, roomNumber: string, roomId: string): boolean {
  const dutyRoomId = d.examRoom?.room?._id;
  if (dutyRoomId && roomId) {
    return dutyRoomId === roomId;
  }
  return d.room === roomNumber;
}

/**
 * True when the viewer holds a duty FOR THIS ROLE in the given schedule+room
 * slot. Role matters: an Associate Professor who invigilates room 005 does not
 * "own" the RS slot of the same room — that slot is still vacant to them. When
 * `viewerRole` is omitted the check stays role-agnostic (legacy callers).
 */
export function isMyDutyInRoom(
  duties: Duty[],
  scheduleDate: string,
  startTime: string,
  endTime: string,
  roomNumber: string,
  roomId: string,
  viewerRole?: string,
): boolean {
  const target = new Date(scheduleDate);
  target.setHours(0, 0, 0, 0);
  return duties.some((d) => {
    if (d.status !== "assigned") return false;
    if (viewerRole && (d.role ?? "invigilator") !== viewerRole) return false;
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    if (dDate.getTime() !== target.getTime()) return false;
    if (d.startTime !== startTime || d.endTime !== endTime) return false;
    return dutyMatchesRoom(d, roomNumber, roomId);
  });
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * True when the viewer holds an assigned duty on the same day whose time
 * window overlaps this slot but is NOT this exact room — i.e. picking this
 * room would create a real conflict for them. Mirrors the conflict engine
 * used by Select Duty so the Exams chips paint red in the same situations.
 */
export function hasTimeConflictForSlot(
  duties: Duty[],
  scheduleDate: string,
  startTime: string,
  endTime: string,
  roomNumber: string,
  roomId: string,
  viewerRole?: string,
): boolean {
  const target = new Date(scheduleDate);
  target.setHours(0, 0, 0, 0);
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return duties.some((d) => {
    if (d.status !== "assigned") return false;
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    if (dDate.getTime() !== target.getTime()) return false;
    // Skip the exact same slot only when it's the viewer's OWN-role duty —
    // that's "mine", not a conflict. A different-role duty in the same room+slot
    // (e.g. my invigilator duty while viewing the RS slot) IS a conflict: one
    // person can't staff two roles at once.
    const ownRoleHere =
      (!viewerRole || (d.role ?? "invigilator") === viewerRole) &&
      d.startTime === startTime &&
      d.endTime === endTime &&
      dutyMatchesRoom(d, roomNumber, roomId);
    if (ownRoleHere) return false;
    return toMinutes(d.startTime) < end && start < toMinutes(d.endTime);
  });
}
