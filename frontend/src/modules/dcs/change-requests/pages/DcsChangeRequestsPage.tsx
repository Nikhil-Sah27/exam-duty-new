import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import type { DcsDutyGroup } from "@/modules/duties/services/dcsGroupingService";
import {
  useMyDcsGroupAssignments,
  useMyDcsChangeRequests,
} from "../hooks/useDcsChangeRequests";
import DcsGroupRequestCard from "../components/DcsGroupRequestCard";
import ChangeRequestCard from "@/modules/shared/change-requests/components/ChangeRequestCard";
import DcsSwapTargetModal from "../components/DcsSwapTargetModal";

const isUpcoming = (group: DcsDutyGroup): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(group.schedule.date);
  day.setHours(0, 0, 0, 0);
  return day >= today;
};

/**
 * The DCS-side Change Requests page. Replaces the per-classroom invigilator
 * view: every "Request Change" action operates on a whole DCS Duty Group, not
 * on individual rooms. Pending/decided history below mirrors the invigilator
 * page but uses the same shared ChangeRequestCard — which now understands the
 * dcs_group scope and renders source + target group blocks.
 */
export default function DcsChangeRequestsPage() {
  const assignmentsQuery = useMyDcsGroupAssignments();
  const requestsQuery = useMyDcsChangeRequests();

  const [activeSource, setActiveSource] = useState<DcsDutyGroup | null>(null);

  const myAssignments = assignmentsQuery.data ?? [];
  const upcomingAssignments = useMemo(
    () => myAssignments.filter(isUpcoming),
    [myAssignments]
  );

  // A group with a pending dcs_swap request can't get another one queued —
  // mirror the same gate the backend enforces.
  const pendingSourceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of requestsQuery.data ?? []) {
      if (r.status === "pending" && r.dcsSourceGroup?._id) {
        ids.add(r.dcsSourceGroup._id);
      }
    }
    return ids;
  }, [requestsQuery.data]);

  const pendingRequests = (requestsQuery.data ?? []).filter(
    (r) => r.status === "pending"
  );
  const decidedRequests = (requestsQuery.data ?? []).filter(
    (r) => r.status !== "pending"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Change Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Request to swap one of your DCS duty groups for another open group.
          DCS works on whole groups — not individual classrooms.
        </p>
      </div>

      {/* My DCS duty groups */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          My DCS Duty Groups
        </h2>

        {assignmentsQuery.isLoading && (
          <p className="text-sm text-gray-500">Loading your groups...</p>
        )}

        {!assignmentsQuery.isLoading && upcomingAssignments.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
            <CalendarClock className="h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">
              You have no upcoming DCS duty groups.
            </p>
            <p className="text-xs text-gray-400">
              Visit Select Duty to pick a supervision group first.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {upcomingAssignments.map((g) => (
            <DcsGroupRequestCard
              key={g._id}
              group={g}
              variant="owned"
              pending={pendingSourceIds.has(g._id)}
              onRequestChange={setActiveSource}
            />
          ))}
        </div>
      </section>

      {/* Pending swap requests */}
      {pendingRequests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Pending Swap Requests
          </h2>
          <div className="space-y-2">
            {pendingRequests.map((r) => (
              <ChangeRequestCard key={r._id} request={r} />
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {decidedRequests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            History
          </h2>
          <div className="space-y-2">
            {decidedRequests.map((r) => (
              <ChangeRequestCard key={r._id} request={r} />
            ))}
          </div>
        </section>
      )}

      <DcsSwapTargetModal
        open={Boolean(activeSource)}
        source={activeSource}
        myAssignments={myAssignments}
        onClose={() => setActiveSource(null)}
      />
    </div>
  );
}
