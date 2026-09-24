import { useState } from "react";
import { Link } from "react-router-dom";
import {
  assignDutyHrefFor,
  eligibleAssignRolesFor,
} from "../config/assignDutyRoutes";
import type { UserRole } from "@/shared/lib/types";
import AssignRolePickerModal from "./AssignRolePickerModal";

interface AssignDutyRoleButtonProps {
  teacherId: string;
  teacherName: string;
  /** Every role the teacher holds (may include `cs`). */
  teacherRoles: UserRole[];
}

/**
 * Smart "+ Assign Duty" button on the teacher-detail page.
 *
 *  - 0 supported roles → nothing rendered (e.g. pure-CS admin users).
 *  - 1 supported role  → direct <Link> into that role's flow.
 *  - 2+ supported roles → opens `AssignRolePickerModal` (card-style picker).
 *
 * All routing knowledge lives in `config/assignDutyRoutes.ts`; this component
 * only decides whether to link straight through or open the modal.
 */
export default function AssignDutyRoleButton({
  teacherId,
  teacherName,
  teacherRoles,
}: AssignDutyRoleButtonProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const eligible = eligibleAssignRolesFor(teacherRoles);

  if (eligible.length === 0) return null;

  if (eligible.length === 1) {
    return (
      <Link
        to={assignDutyHrefFor(teacherId, eligible[0])}
        className="shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500"
      >
        + Assign Duty
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500"
      >
        + Assign Duty
      </button>
      <AssignRolePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        teacherId={teacherId}
        teacherName={teacherName}
        choices={eligible}
      />
    </>
  );
}
