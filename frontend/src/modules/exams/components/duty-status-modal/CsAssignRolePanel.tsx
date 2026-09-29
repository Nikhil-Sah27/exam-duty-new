import type { ExamRoomAssignment, ExamSchedule } from "../../types";
import CsInvigilatorAssignPanel from "../cs-assign/CsInvigilatorAssignPanel";
import CsRsGroupAssignPanel from "../cs-assign/CsRsGroupAssignPanel";
import CsDcsGroupAssignPanel from "../cs-assign/CsDcsGroupAssignPanel";

export type AssignRole = "dcs" | "rs" | "invigilator";

interface CsAssignRolePanelProps {
  assignRole: AssignRole;
  schedule: ExamSchedule;
  assignment: ExamRoomAssignment;
  onBack: () => void;
  onAssigned: () => void;
}

/** CS assignment flow: renders the role-specific assign panel for the
 *  slot the CS clicked in the overview. */
export default function CsAssignRolePanel({
  assignRole,
  schedule,
  assignment,
  onBack,
  onAssigned,
}: CsAssignRolePanelProps) {
  return (
    <div className="px-5 py-4">
      {assignRole === "invigilator" && (
        <CsInvigilatorAssignPanel
          schedule={schedule}
          assignment={assignment}
          onBack={onBack}
          onAssigned={onAssigned}
        />
      )}
      {assignRole === "rs" && (
        <CsRsGroupAssignPanel
          schedule={schedule}
          assignment={assignment}
          onBack={onBack}
          onAssigned={onAssigned}
        />
      )}
      {assignRole === "dcs" && (
        <CsDcsGroupAssignPanel
          schedule={schedule}
          assignment={assignment}
          onBack={onBack}
          onAssigned={onAssigned}
        />
      )}
    </div>
  );
}
