import { AlertCircle, Mail, Phone, UserRound } from "lucide-react";
import type { AssigneePublic, RoomDutyFlags } from "@/modules/exams/types";
import {
  HUMAN_ROLE_LABEL,
  type OperationalRoleKey,
} from "../utils/assignmentStatusUtils";
import {
  getRoleDisplayPaint,
  getRoleDisplayState,
  getRoleTeacher,
  isMyRole,
  type RoleDisplayState,
} from "../utils/roleAssignmentUtils";
import RoleStatusBadge from "./RoleStatusBadge";

const SHORT_ROLE_LABEL: Record<OperationalRoleKey, string> = {
  invigilator: "Invigilator",
  rs: "RS",
  dcs: "DCS",
};

export interface RoleAssignmentCardProps {
  role: OperationalRoleKey;
  /** Whose perspective is rendering this row. Drives role isolation. */
  viewerRole: OperationalRoleKey | null | undefined;
  flags: RoomDutyFlags | undefined;
  /** Logged-in user's id — used to detect OWNED for the viewer's row. */
  myUserId: string | null | undefined;
  /**
   * Whether the viewer has a time-conflict on THEIR OWN role for this slot.
   * Conflicts never paint other-role rows red — role isolation rule.
   */
  hasViewerConflict?: boolean;
  /** Force OWNED for the viewer's row even when the flag hasn't refetched. */
  isMine?: boolean;
  /**
   * Reveal the assignee's identity/contact for OTHER roles too. Set only when
   * the viewer holds a duty in THIS room — co-assigned staff (their room's DCS /
   * RS / invigilator) may see each other to coordinate. Rooms where the viewer
   * has no duty leave this false, so occupied slots stay anonymous.
   */
  revealAssignees?: boolean;
  /** Optional action (e.g. "Select Duty" on the viewer's row when OPEN). */
  action?: React.ReactNode;
  /** Optional note rendered below the assignee block. */
  note?: string;
  noteTone?: "info" | "warn";
}

/**
 * The single component every teacher dashboard uses to render a "this
 * role on this room" row. Role isolation is enforced here, not at the
 * call site: pass the viewer's role and the card decides what to paint.
 *
 *   Viewer's own role  → green (OPEN) / blue (OWNED) / red (BLOCKED)
 *   Other roles        → neutral gray, informational only
 *
 * Time conflicts NEVER flow into other-role rows. The same DCS assignee
 * rendered for an Invigilator viewer reads "Assigned" in gray — no red,
 * no "Conflict", no "Unavailable".
 */
export default function RoleAssignmentCard({
  role,
  viewerRole,
  flags,
  myUserId,
  hasViewerConflict,
  isMine,
  revealAssignees,
  action,
  note,
  noteTone = "info",
}: RoleAssignmentCardProps) {
  const state: RoleDisplayState = getRoleDisplayState({
    role,
    viewerRole,
    flags,
    myUserId,
    hasViewerConflict,
    isMine,
  });
  const paint = getRoleDisplayPaint(state);
  const teacher: AssigneePublic | null = getRoleTeacher(flags, role);
  const own = isMyRole(role, viewerRole);

  // The assignee's identity/contact shows for the viewer's OWN duty (OWNED), and
  // — when `revealAssignees` is set (viewer holds a duty in THIS room) — for the
  // room's other role holders too, so co-assigned staff can coordinate. In every
  // other case an occupied slot stays anonymous ("Occupied", no name).
  const showAssignee = state === "OWNED" || (Boolean(revealAssignees) && !!teacher);
  // A co-assignee revealed because the viewer shares this room (not their own
  // duty) gets a subtle highlight, so their contact stands out as someone to
  // coordinate with rather than plain informational text.
  const isRevealedCoAssignee = showAssignee && state !== "OWNED";

  const fullRoleLabel = HUMAN_ROLE_LABEL[role];
  const tooltip = teacher
    ? showAssignee
      ? [
          teacher.name,
          teacher.designation || fullRoleLabel,
          teacher.department || "—",
          teacher.phone || teacher.email,
        ]
          .filter(Boolean)
          .join("\n")
      : `${fullRoleLabel}\nOccupied.`
    : own
      ? `${fullRoleLabel}\nAvailable for selection.`
      : `${fullRoleLabel}\nNobody has been assigned to this role yet.`;

  return (
    <article
      title={tooltip}
      className={`group flex flex-col gap-2 rounded-xl border-2 bg-white p-3 shadow-sm transition-all hover:shadow-md ${paint.border}`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            {SHORT_ROLE_LABEL[role]}
          </p>
          <p className="text-lg font-bold text-gray-800">{fullRoleLabel}</p>
        </div>
        <RoleStatusBadge state={state} />
      </header>

      {teacher && showAssignee ? (
        <div
          className={`rounded-lg border px-2.5 py-2 ${
            isRevealedCoAssignee
              ? "border-indigo-200 bg-indigo-50/60 ring-1 ring-indigo-100"
              : "border-gray-100 bg-gray-50/70"
          }`}
        >
          <div className="flex items-start gap-2">
            <UserRound
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                isRevealedCoAssignee ? "text-indigo-500" : "text-gray-400"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-bold ${
                  state === "OWNED"
                    ? "text-blue-700"
                    : isRevealedCoAssignee
                      ? "text-indigo-700"
                      : "text-gray-800"
                }`}
              >
                {teacher.name}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                {teacher.designation && (
                  <span className="text-gray-500">{teacher.designation}</span>
                )}
                {teacher.department && (
                  <span className="rounded bg-gray-100 px-1 py-0 text-[10px] font-semibold text-gray-600">
                    {teacher.department}
                  </span>
                )}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-600">
                {teacher.phone && (
                  <a
                    href={`tel:${teacher.phone}`}
                    className="flex items-center gap-1 hover:text-blue-700"
                  >
                    <Phone className="h-3 w-3" />
                    {teacher.phone}
                  </a>
                )}
                <a
                  href={`mailto:${teacher.email}`}
                  className="flex items-center gap-1 hover:text-blue-700"
                >
                  <Mail className="h-3 w-3" />
                  {teacher.email}
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : teacher ? (
        // Occupied by someone else (or another role) — status only, no identity.
        // Only CS is allowed to see who holds the duty.
        <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/70 px-2.5 py-2 text-xs text-gray-600">
          <UserRound className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>
            {state === "BLOCKED"
              ? `Occupied — ${fullRoleLabel} duty unavailable`
              : `Occupied — ${fullRoleLabel} assigned`}
          </span>
        </div>
      ) : (
        <div
          className={`flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-2 text-xs ${
            own && state === "BLOCKED"
              ? "border-red-200 bg-red-50/70 text-red-700"
              : "border-gray-200 bg-white/80 text-gray-500"
          }`}
        >
          <AlertCircle
            className={`h-3.5 w-3.5 ${own && state === "BLOCKED" ? "text-red-400" : "text-gray-400"}`}
          />
          {own
            ? state === "BLOCKED"
              ? "You already have a duty during this time slot — you can't take this."
              : "Vacant — you can take this duty."
            : `Vacant — no one has been assigned as ${fullRoleLabel} yet.`}
        </div>
      )}

      {note && (
        <p
          className={`text-[11px] ${noteTone === "warn" ? "text-red-700" : "text-gray-500"}`}
        >
          {note}
        </p>
      )}

      {action && <div className="pt-0.5">{action}</div>}
    </article>
  );
}
