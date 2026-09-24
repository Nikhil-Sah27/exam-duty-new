import { useState } from "react";
import { useAuthStore } from "@/shared/store/auth.store";
import { useAllChangeRequests } from "@/modules/shared/change-requests/hooks/useChangeRequests";
import type { ChangeRequestStatus } from "@/modules/shared/change-requests/types/changeRequest.types";
import ChangeRequestCard from "@/modules/shared/change-requests/components/ChangeRequestCard";
import ReviewActions from "./ReviewActions";

const TABS: { value: ChangeRequestStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function ChangeRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const isCS = user?.activeRole === "cs" || user?.activeRole === "dcs";

  const [tab, setTab] = useState<ChangeRequestStatus>("pending");
  const { data: requests, isLoading, error } = useAllChangeRequests(tab);
  const list = requests ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Change Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and approve duty change requests submitted by teachers.
        </p>
      </div>

      <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.value
                ? "bg-gray-800 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading requests...</p>}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load requests.
        </div>
      )}

      {!isLoading && list.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500">No {tab} requests.</p>
        </div>
      )}

      <div className="space-y-3">
        {list.map((r) => (
          <ChangeRequestCard
            key={r._id}
            request={r}
            reviewActions={
              isCS && r.status === "pending" ? <ReviewActions requestId={r._id} /> : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
