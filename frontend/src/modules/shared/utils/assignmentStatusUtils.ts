import type {
  AssigneePublic,
  RoomDutyFlags,
} from "@/modules/exams/types";

/**
 * Teacher-perspective assignment status. Distinct from the CS-perspective
 * `DutyStatus` (NOT_ASSIGNED / PARTIAL / FULLY_ASSIGNED) because teachers
 * care about a single question — "can I take this duty?" — not about how
 * filled the room is overall.
 *
 *   AVAILABLE — the slot is open for the viewer's role
 *   MINE      — the viewer already owns this slot
 *   OCCUPIED  — another teacher in the viewer's role owns it
 *   CONFLICT  — the time overlaps with another duty the viewer holds /
 *               has selected, so they can't take it even though it's open
 */
export type TeacherAssignmentStatus =
  | "AVAILABLE"
  | "MINE"
  | "OCCUPIED"
  | "CONFLICT";

export type OperationalRoleKey = "invigilator" | "rs" | "dcs";

/**
 * A single role slot inside a room, used by the modal + chips. CONFLICT is
 * only ever surfaced on the viewer's OWN role row when their existing
 * commitments block them from selecting — every other row stays VACANT.
 */
export type AssignmentRoleStatus = "ASSIGNED" | "MINE" | "VACANT" | "CONFLICT";

const FLAG_KEY_BY_ROLE: Record<OperationalRoleKey, keyof RoomDutyFlags> = {
  invigilator: "invigilatorAssigned",
  rs: "rsAssigned",
  dcs: "dcsAssigned",
};

const TEACHER_KEY_BY_ROLE: Record<
  OperationalRoleKey,
  "invigilatorTeacher" | "rsTeacher" | "dcsTeacher"
> = {
  invigilator: "invigilatorTeacher",
  rs: "rsTeacher",
  dcs: "dcsTeacher",
};

export const HUMAN_ROLE_LABEL: Record<OperationalRoleKey, string> = {
  invigilator: "Invigilator",
  rs: "Room Superintendent",
  dcs: "Deputy Chief Superintendent",
};


/**
 * Resolve the assignment status of a single role within a room, from the
 * viewer's perspective. `myUserId` lets the function decide MINE vs OCCUPIED
 * without the caller juggling IDs.
 */
export function getRoleAssignmentStatus(
  flags: RoomDutyFlags | undefined,
  role: OperationalRoleKey,
  myUserId: string | null | undefined,
): AssignmentRoleStatus {
  if (!flags) return "VACANT";
  if (!flags[FLAG_KEY_BY_ROLE[role]]) return "VACANT";
  const teacher = flags[TEACHER_KEY_BY_ROLE[role]];
  if (teacher && myUserId && teacher._id === myUserId) return "MINE";
  return "ASSIGNED";
}

export function getRoleAssignee(
  flags: RoomDutyFlags | undefined,
  role: OperationalRoleKey,
): AssigneePublic | null {
  if (!flags) return null;
  return flags[TEACHER_KEY_BY_ROLE[role]] ?? null;
}

/**
 * Top-level "can I select this?" status. Mine wins over Occupied so the
 * card reads as the user's own duty; Conflict wins over Available so we
 * never surface a clickable card that would fail validation.
 */
export function getTeacherAssignmentStatus(args: {
  flags: RoomDutyFlags | undefined;
  viewerRole: OperationalRoleKey;
  myUserId: string | null | undefined;
  hasConflict?: boolean;
}): TeacherAssignmentStatus {
  const { flags, viewerRole, myUserId, hasConflict } = args;
  const roleStatus = getRoleAssignmentStatus(flags, viewerRole, myUserId);
  if (roleStatus === "MINE") return "MINE";
  if (roleStatus === "ASSIGNED") return "OCCUPIED";
  if (hasConflict) return "CONFLICT";
  return "AVAILABLE";
}

// ── Color + label tables ─────────────────────────────────────────────

/**
 * Teacher-dashboard colour map. Strictly green / blue / red per the UX
 * brief — yellow/amber is reserved for the conflict banner copy elsewhere
 * and intentionally not surfaced as a primary status colour here.
 */
export interface StatusPaint {
  /** Border + outline for cards/chips. */
  border: string;
  /** Background tint. */
  bg: string;
  /** Solid dot used in legend rows and chips. */
  dot: string;
  /** Text colour for status copy. */
  text: string;
  /** Gradient pill — drives badge backgrounds. */
  gradient: string;
  /** Hex-ish swatch for the legend square. */
  swatch: string;
}

const TEACHER_PAINT: Record<TeacherAssignmentStatus, StatusPaint> = {
  AVAILABLE: {
    border: "border-emerald-300",
    bg: "bg-emerald-50 hover:bg-emerald-100",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    gradient: "bg-gradient-to-r from-emerald-500 to-teal-500",
    swatch: "bg-emerald-500",
  },
  MINE: {
    border: "border-blue-400",
    bg: "bg-blue-50 hover:bg-blue-100",
    dot: "bg-blue-500",
    text: "text-blue-700",
    gradient: "bg-gradient-to-r from-blue-600 to-indigo-600",
    swatch: "bg-blue-500",
  },
  OCCUPIED: {
    border: "border-red-300",
    bg: "bg-red-50/70 cursor-not-allowed",
    dot: "bg-red-500",
    text: "text-red-700",
    gradient: "bg-gradient-to-r from-red-500 to-rose-500",
    swatch: "bg-red-500",
  },
  CONFLICT: {
    border: "border-red-300",
    bg: "bg-red-50/70 cursor-not-allowed",
    dot: "bg-red-500",
    text: "text-red-700",
    gradient: "bg-gradient-to-r from-red-500 to-rose-500",
    swatch: "bg-red-500",
  },
};

const TEACHER_LABEL: Record<TeacherAssignmentStatus, string> = {
  AVAILABLE: "Available",
  MINE: "My Duty",
  OCCUPIED: "Occupied",
  CONFLICT: "Time Conflict",
};

export function getTeacherStatusPaint(status: TeacherAssignmentStatus): StatusPaint {
  return TEACHER_PAINT[status];
}

export function getTeacherStatusLabel(status: TeacherAssignmentStatus): string {
  return TEACHER_LABEL[status];
}

/**
 * Per-role badge inside the assignment card. ASSIGNED renders red because
 * from a teacher's perspective another teacher owning a role means "I can't
 * take this"; MINE is blue ("yours"); VACANT is green ("up for grabs").
 */
const ROLE_PAINT: Record<AssignmentRoleStatus, StatusPaint> = {
  ASSIGNED: TEACHER_PAINT.OCCUPIED,
  MINE: TEACHER_PAINT.MINE,
  VACANT: TEACHER_PAINT.AVAILABLE,
  CONFLICT: TEACHER_PAINT.CONFLICT,
};

export function getRolePaint(status: AssignmentRoleStatus): StatusPaint {
  return ROLE_PAINT[status];
}

const ROLE_STATUS_LABEL: Record<AssignmentRoleStatus, string> = {
  ASSIGNED: "Occupied",
  MINE: "Your Duty",
  VACANT: "Vacant",
  CONFLICT: "Time Conflict",
};

export function getRoleStatusLabel(status: AssignmentRoleStatus): string {
  return ROLE_STATUS_LABEL[status];
}

export function getRoleLabel(role: OperationalRoleKey): string {
  return HUMAN_ROLE_LABEL[role];
}
