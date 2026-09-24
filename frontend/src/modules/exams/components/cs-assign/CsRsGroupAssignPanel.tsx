import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ExamRoomAssignment, ExamSchedule } from "../../types";
import { useAvailableDutySlots } from "@/modules/shared/exams/hooks/useSharedExamData";
import { groupRoomsIntoRSGroups } from "@/modules/rs/select-duty/utils/rsDutyGroupingUtils";
import { useAssignRSGroup } from "@/modules/manage-duties/hooks";
import EligibleTeacherList from "./EligibleTeacherList";
import AssignPanelShell, { AssignContextCard } from "./AssignPanelShell";
import { formatDate, formatTime } from "./format";

/**
 * CS assigns a whole RS group (a chunk of ≤5 rooms in one building + schedule)
 * to one teacher. The group is derived from the EXACT same `groupRoomsIntoRSGroups`
 * util the RS dashboard and RS Select Duty use — no separate grouping for CS —
 * then handed to the transactional `admin-assign-group` path.
 */
export default function CsRsGroupAssignPanel({
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
  const { data: slots, isLoading } = useAvailableDutySlots();
  const mutation = useAssignRSGroup();

  const group = useMemo(() => {
    const scoped = slots.filter((s) => s.scheduleId === schedule._id);
    const groups = groupRoomsIntoRSGroups(scoped);
    return (
      groups.find((g) =>
        g.rooms.some((r) => r.examRoomId === assignment._id)
      ) || null
    );
  }, [slots, schedule._id, assignment._id]);

  const handleAssign = (teacherId: string) => {
    if (!group) return;
    setAssigningId(teacherId);
    mutation.mutate(
      {
        teacher: teacherId,
        examSchedule: schedule._id,
        examRooms: group.rooms.map((r) => r.examRoomId),
      },
      {
        onSuccess: () => onAssigned(),
        onSettled: () => setAssigningId(null),
      }
    );
  };

  return (
    <AssignPanelShell title="Assign RS to Group" onBack={onBack}>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Resolving RS group…
        </div>
      ) : !group ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
          No RS group found for this room (the schedule may not be active).
        </div>
      ) : (
        <>
          <AssignContextCard
            rows={[
              ["RS Group", `Group ${group.chunkIndex + 1} · ${group.buildingName}`],
              ["Date", formatDate(group.date)],
              [
                "Time",
                `${formatTime(group.startTime)} – ${formatTime(group.endTime)}`,
              ],
            ]}
          />

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Rooms in Group ({group.rooms.length})
            </p>
            <ul className="space-y-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {group.rooms.map((r) => (
                <li key={r.examRoomId} className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      r.flags.rsAssigned ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  {r.buildingName} — {r.roomNumber}
                  {r.flags.rsAssigned && (
                    <span className="text-[10px] text-green-600">(assigned)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {group.allAssigned && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This RS group is already fully assigned.
            </div>
          )}

          {mutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {(mutation.error as Error).message}
            </div>
          )}

          <EligibleTeacherList
            role="rs"
            onAssign={handleAssign}
            assigningId={assigningId}
            isPending={mutation.isPending}
            disabled={group.allAssigned}
            actionLabel="Assign to Group"
          />
        </>
      )}
    </AssignPanelShell>
  );
}
