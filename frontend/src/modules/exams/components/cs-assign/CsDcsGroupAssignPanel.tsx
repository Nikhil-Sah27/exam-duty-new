import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ExamRoomAssignment, ExamSchedule } from "../../types";
import { listDcsGroups } from "@/modules/dcs/select-duty/services/dcsDutyService";
import { useAdminClaimDcsGroup } from "@/modules/manage-duties/hooks";
import EligibleTeacherList from "./EligibleTeacherList";
import AssignPanelShell, { AssignContextCard } from "./AssignPanelShell";
import { formatDate, formatTime } from "./format";

/**
 * CS assigns a whole DCS supervision group (student-count-sized) to one
 * teacher. Groups are the persistent `DCSGroup` records generated at exam
 * creation — this panel finds the group that owns the clicked room and reuses
 * the DCS admin-claim path, so CS can never assign a DCS to a single room in
 * isolation.
 */
export default function CsDcsGroupAssignPanel({
  schedule,
  assignment,
  onBack,
  onAssigned,
}: {
  schedule: ExamSchedule;
  assignment: ExamRoomAssignment;
  onBack: () => void;
  onAssigned: () => void;
}) {
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const mutation = useAdminClaimDcsGroup();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["dcs", "groups", "by-exam", schedule.examGroup],
    queryFn: () => listDcsGroups({ examGroup: schedule.examGroup }),
    enabled: !!schedule.examGroup,
  });

  const group =
    groups?.find((g) =>
      g.assignedRooms.some((r) => r._id === assignment._id)
    ) || null;

  const handleAssign = (teacherId: string) => {
    if (!group) return;
    setAssigningId(teacherId);
    mutation.mutate(
      { groupId: group._id, teacher: teacherId },
      {
        onSuccess: () => onAssigned(),
        onSettled: () => setAssigningId(null),
      }
    );
  };

  const claimed = group?.status === "claimed";

  return (
    <AssignPanelShell title="Assign DCS to Group" onBack={onBack}>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Resolving DCS group…
        </div>
      ) : !group ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
          No DCS group covers this room.
        </div>
      ) : (
        <>
          <AssignContextCard
            rows={[
              ["DCS Group", `Group ${group.groupIndex}`],
              ["Date", formatDate(group.schedule.date)],
              [
                "Time",
                `${formatTime(group.schedule.startTime)} – ${formatTime(
                  group.schedule.endTime
                )}`,
              ],
              ["Students", String(group.assignedStudents)],
            ]}
          />

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Rooms handled ({group.assignedRooms.length})
            </p>
            <ul className="space-y-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {group.assignedRooms.map((r) => (
                <li key={r._id}>
                  {(r.room.building?.name || "Unknown") + " — " + r.room.roomNumber}
                </li>
              ))}
            </ul>
          </div>

          {claimed ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs">
              <p className="font-semibold text-green-800">
                Already assigned to {group.assignedTeacher?.name}
              </p>
              {group.assignedTeacher?.department && (
                <p className="text-green-700">
                  {group.assignedTeacher.department}
                </p>
              )}
            </div>
          ) : (
            <>
              {mutation.isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {(mutation.error as Error).message}
                </div>
              )}
              <EligibleTeacherList
                role="dcs"
                onAssign={handleAssign}
                assigningId={assigningId}
                isPending={mutation.isPending}
                actionLabel="Assign to Group"
                conflict={{
                  date: schedule.date,
                  startTime: schedule.startTime,
                  endTime: schedule.endTime,
                }}
              />
            </>
          )}
        </>
      )}
    </AssignPanelShell>
  );
}
