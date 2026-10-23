import type { Href } from "expo-router";

import type { DcsGroup } from "@/features/select-duty/shared/dcsTypes";
import type { Duty } from "@/features/select-duty/shared/dutyTypes";
import { isTeacherRole } from "@/lib/roles";
import type { TeacherRole } from "@/lib/types";

import type { RSUpcomingGroup } from "./shared/rsUpcomingGrouping";

// Duty-unit keys are built by the backend (backend/modules/duty/duty.unit.js
// unitKey): `${examScheduleId || dutyId}|${role}` — the same `key` that
// GET /duties/my-units returns and duty/[key] takes. The request screen
// accepts that key, so any unit can link straight to "request a change".

export function parseUnitKey(key: string | undefined): { id: string; role: TeacherRole } | null {
  if (!key) return null;
  const cut = key.lastIndexOf("|");
  if (cut <= 0) return null;
  const role = key.slice(cut + 1);
  if (!isTeacherRole(role as TeacherRole)) return null;
  return { id: key.slice(0, cut), role: role as TeacherRole };
}

export const unitKeyOfDuty = (d: Duty): string => `${d.examSchedule?._id || d._id}|${d.role ?? "invigilator"}`;

/** An RS group is one unit per schedule (its first duty carries the schedule). */
export const unitKeyOfRsGroup = (g: RSUpcomingGroup): string => {
  const d = g.rooms[0]?.duty;
  return d ? `${d.examSchedule?._id || d._id}|rs` : `${g.scheduleId}|rs`;
};

export const unitKeyOfDcsGroup = (g: DcsGroup): string => `${g.schedule._id}|dcs`;

/** The change-requests list (role-aware). */
export const CHANGE_REQUESTS_HREF = "/change-requests" as Href;

/**
 * "Request a change" for one duty unit. `source` optionally pins the exact
 * duty id (invigilator), RS groupId or DCSGroup id when a unit holds several.
 */
export const requestChangeHref = (key: string, source?: string): Href =>
  ({ pathname: "/request-change/[key]", params: source ? { key, source } : { key } }) as Href;
