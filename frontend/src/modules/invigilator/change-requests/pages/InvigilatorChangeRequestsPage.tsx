import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useAuthStore } from "@/shared/store/auth.store";
import { EmptyState } from "@/shared/components";
import { useDutiesByTeacher } from "@/modules/shared/exams/hooks/useSharedExamData";
import { useMyChangeRequests } from "@/modules/shared/change-requests/hooks/useChangeRequests";
import { hasPendingRequest } from "@/modules/shared/change-requests/utils/changeRequestValidation";
import ChangeRequestCard from "@/modules/shared/change-requests/components/ChangeRequestCard";
import type { Duty } from "@/modules/duties/types";
import MyDutyCard from "../components/MyDutyCard";
import RequestChangeModal from "../components/RequestChangeModal";

export default function InvigilatorChangeRequestsPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const dutiesQuery = useDutiesByTeacher(userId, "invigilator");
  const requestsQuery = useMyChangeRequests();

  const [activeDuty, setActiveDuty] = useState<Duty | null>(null);

  const allDuties = dutiesQuery.data ?? [];
  const myRequests = requestsQuery.data ?? [];

  // Show only upcoming, assigned duties (not past, not cancelled, not completed).
  const upcomingDuties = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allDuties
      .filter((d) => {
        if (d.status !== "assigned") return false;
        const day = new Date(d.date);
        day.setHours(0, 0, 0, 0);
        return day >= today;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allDuties]);

  const pendingRequests = myRequests.filter((r) => r.status === "pending");
  const decidedRequests = myRequests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Change Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Request to move one of your upcoming duties to a vacant slot. Pending requests
          await controller review.
        </p>
      </div>

      {/* My upcoming duties */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          My Upcoming Duties
        </h2>
        {dutiesQuery.isLoading && (
          <p className="text-sm text-gray-500">Loading your duties...</p>
        )}
        {!dutiesQuery.isLoading && upcomingDuties.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title="No upcoming duties assigned to you"
            description="Once a duty is assigned, you'll be able to request changes here."
          />
        )}
        <div className="space-y-2">
          {upcomingDuties.map((d) => (
            <MyDutyCard
              key={d._id}
              duty={d}
              pending={hasPendingRequest(d._id, myRequests)}
              onRequestChange={setActiveDuty}
            />
          ))}
        </div>
      </section>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Pending Requests
          </h2>
          <div className="space-y-2">
            {pendingRequests.map((r) => (
              <ChangeRequestCard key={r._id} request={r} />
            ))}
          </div>
        </section>
      )}

      {/* Decided requests */}
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

      <RequestChangeModal
        open={Boolean(activeDuty)}
        duty={activeDuty}
        myDuties={allDuties}
        onClose={() => setActiveDuty(null)}
      />
    </div>
  );
}
