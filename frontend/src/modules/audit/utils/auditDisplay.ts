import { formatDate } from "@/shared/lib/utils";
import type { AuditLogEntry } from "../types";

/** Human-readable label + badge tone for every audit action. */
export const ACTION_META: Record<string, { label: string; tone: string }> = {
  SELF_ASSIGN_DUTY: { label: "Duty claimed", tone: "emerald" },
  SELF_ASSIGN_DUTY_GROUP: { label: "Group claimed", tone: "emerald" },
  ADMIN_ASSIGN_DUTY: { label: "Duty assigned by CS", tone: "blue" },
  // A CS-assigned RS group is still a duty assignment from the CS's point of
  // view — surface it as "Duty assigned by CS" rather than a separate "Group".
  ADMIN_ASSIGN_DUTY_GROUP: { label: "Duty assigned by CS", tone: "blue" },
  CANCEL_DUTY: { label: "Duty cancelled", tone: "amber" },
  // Single room, RS group or DCS group — all one "unassigned by CS" to the CS.
  ADMIN_UNASSIGN_DUTY: { label: "Duty unassigned by CS", tone: "red" },
  ADMIN_UNASSIGN_DUTY_GROUP: { label: "Duty unassigned by CS", tone: "red" },
  CLAIM_DCS_GROUP: { label: "DCS group claimed", tone: "emerald" },
  // A CS-assigned DCS group is a duty assignment from the CS's point of view —
  // surface it the same as any other "Duty assigned by CS".
  ADMIN_CLAIM_DCS_GROUP: { label: "Duty assigned by CS", tone: "blue" },
  RELEASE_DCS_GROUP: { label: "DCS group released", tone: "amber" },
  SUBMIT_CHANGE_REQUEST: { label: "Change request submitted", tone: "indigo" },
  APPROVE_CHANGE_REQUEST: { label: "Change request approved", tone: "emerald" },
  REJECT_CHANGE_REQUEST: { label: "Change request rejected", tone: "red" },
  CREATE_EXAM: { label: "Exam created", tone: "emerald" },
  DELETE_EXAM: { label: "Exam deleted", tone: "red" },
  CREATE_USER: { label: "Teacher created", tone: "emerald" },
  UPDATE_USER: { label: "Teacher updated", tone: "blue" },
  DEACTIVATE_USER: { label: "Teacher deactivated", tone: "amber" },
  REACTIVATE_USER: { label: "Teacher reactivated", tone: "emerald" },
  SEND_BROADCAST: { label: "Announcement sent", tone: "indigo" },
};

export const BADGE_TONES: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  gray: "bg-gray-100 text-gray-600 ring-gray-200",
};

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

const slot = (d: Record<string, unknown>): string => {
  const parts: string[] = [];
  if (d.date) parts.push(formatDate(str(d.date)));
  if (d.startTime && d.endTime) parts.push(`${d.startTime}–${d.endTime}`);
  return parts.join(" · ");
};

/**
 * One-line summary of an entry's `details` payload. Built from the snapshot
 * captured at write time, so it stays meaningful even after the underlying
 * duty/exam/user is changed or deleted.
 */
export function summarizeDetails(entry: AuditLogEntry): string {
  const d = entry.details ?? {};
  switch (entry.action) {
    case "SELF_ASSIGN_DUTY":
    case "ADMIN_ASSIGN_DUTY":
    case "ADMIN_UNASSIGN_DUTY":
    case "CANCEL_DUTY": {
      const parts = [
        d.role ? str(d.role).toUpperCase() : "",
        d.room ? `Room ${d.room}` : "",
        slot(d as Record<string, unknown>),
      ].filter(Boolean);
      if (entry.action !== "ADMIN_ASSIGN_DUTY" && d.reason) parts.push(`Reason: ${d.reason}`);
      return parts.join(" · ");
    }
    case "SELF_ASSIGN_DUTY_GROUP":
    case "ADMIN_ASSIGN_DUTY_GROUP":
    case "ADMIN_UNASSIGN_DUTY_GROUP": {
      const rooms = Array.isArray(d.rooms) ? d.rooms.join(", ") : "";
      return [
        d.role ? str(d.role).toUpperCase() : "",
        d.roomCount ? `${d.roomCount} rooms` : "",
        rooms ? `(${rooms})` : "",
        slot(d as Record<string, unknown>),
        d.reason ? `Reason: ${d.reason}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "CLAIM_DCS_GROUP":
    case "ADMIN_CLAIM_DCS_GROUP":
      return d.dutyCount ? `${d.dutyCount} rooms in group` : "";
    case "RELEASE_DCS_GROUP":
      return d.reason ? `Reason: ${d.reason}` : "";
    case "SUBMIT_CHANGE_REQUEST":
    case "APPROVE_CHANGE_REQUEST":
    case "REJECT_CHANGE_REQUEST": {
      const parts = [d.type ? str(d.type).replace(/_/g, " ") : "", d.scope ? `(${d.scope})` : ""];
      if (d.note) parts.push(`Note: ${d.note}`);
      return parts.filter(Boolean).join(" ");
    }
    case "CREATE_EXAM":
      return [
        d.examType,
        d.semester ? `Sem ${d.semester}` : "",
        d.schedulesCreated ? `${d.schedulesCreated} schedules` : "",
        d.roomsCreated ? `${d.roomsCreated} rooms` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    case "DELETE_EXAM":
      return [
        d.releasedDutyCount !== undefined ? `${d.releasedDutyCount} duties released` : "",
        d.cancelledChangeRequestCount ? `${d.cancelledChangeRequestCount} change requests cancelled` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    case "CREATE_USER":
    case "UPDATE_USER":
    case "REACTIVATE_USER": {
      const roles = Array.isArray(d.roles) ? d.roles.join(", ").toUpperCase() : "";
      return [d.name, d.email ? `(${d.email})` : "", d.designation, roles]
        .filter(Boolean)
        .join(" · ");
    }
    case "SEND_BROADCAST":
      return [
        d.title ? `“${d.title}”` : "",
        d.audience ? `to ${d.audience}` : "",
        d.sent !== undefined ? `${d.sent} recipients` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    default: {
      // Unknown action — render whatever flat detail values exist.
      return Object.entries(d)
        .filter(([k, v]) => k !== "actorRole" && (typeof v === "string" || typeof v === "number"))
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
    }
  }
}
