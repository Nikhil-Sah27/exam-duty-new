import { useState } from "react";
import { Clock, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import { useAuthStore } from "@/shared/store/auth.store";
import { EmptyState, ConfirmActionModal } from "@/shared/components";
import {
  useAllChangeRequests,
  useDeleteChangeRequest,
} from "@/modules/shared/change-requests/hooks/useChangeRequests";
import type { ChangeRequestStatus } from "@/modules/shared/change-requests/types/changeRequest.types";
import ChangeRequestCard from "@/modules/shared/change-requests/components/ChangeRequestCard";
import ReviewActions from "./ReviewActions";

const TABS: {
  value: ChangeRequestStatus;
  label: string;
  icon: typeof Clock;
  /** Classes for the active (selected) tab — one accent per status. */
  active: string;
  /** Icon-bubble classes for the empty state. */
  bubble: string;
  hint: string;
}[] = [
  {
    value: "pending",
    label: "Pending",
    icon: Clock,
    active: "bg-amber-500 text-white shadow-md shadow-amber-500/30",
    bubble: "bg-amber-100 text-amber-600",
    hint: "Teachers haven't submitted any duty change requests yet.",
  },
  {
    value: "approved",
    label: "Approved",
    icon: CheckCircle2,
    active: "bg-emerald-600 text-white shadow-md shadow-emerald-500/30",
    bubble: "bg-emerald-100 text-emerald-600",
    hint: "Requests you approve will show up here.",
  },
  {
    value: "rejected",
    label: "Rejected",
    icon: XCircle,
    active: "bg-rose-600 text-white shadow-md shadow-rose-500/30",
    bubble: "bg-rose-100 text-rose-600",
    hint: "Requests you reject will show up here.",
  },
];

export default function ChangeRequestsPage() {
  const user = useAuthStore((s) => s.user);
  // Approving/rejecting change requests is CS-only (enforced on the backend via
  // requireRole("cs")). DCS never reviews requests, so don't show the actions.
  const canReview = user?.activeRole === "cs";

  const [tab, setTab] = useState<ChangeRequestStatus>("pending");
  // CS can delete any change-request record (removes it from the list/history;
  // the delete is audit-logged on the backend). Track which one is pending a
  // confirm.
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteMutation = useDeleteChangeRequest();

  // Load every status up-front so each tab can show its own count. React Query
  // dedupes and caches, so the active tab's data is shared, not fetched twice.
  const queries: Record<
    ChangeRequestStatus,
    ReturnType<typeof useAllChangeRequests>
  > = {
    pending: useAllChangeRequests("pending"),
    approved: useAllChangeRequests("approved"),
    rejected: useAllChangeRequests("rejected"),
  };

  const active = queries[tab];
  const list = active.data ?? [];
  const activeTab = TABS.find((t) => t.value === tab)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Change Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and approve duty change requests submitted by teachers.
        </p>
      </div>

      <div className="flex w-fit flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.value;
          const count = queries[t.value].data?.length ?? 0;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
                isActive ? t.active : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span
                className={`inline-flex min-w-[1.375rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {active.isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-16 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
        </div>
      )}

      {active.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load requests.
        </div>
      )}

      {!active.isLoading && !active.error && list.length === 0 && (
        <EmptyState
          icon={activeTab.icon}
          accent={activeTab.bubble}
          title={`No ${tab} requests`}
          description={activeTab.hint}
        />
      )}

      <div className="space-y-3">
        {list.map((r) => (
          <ChangeRequestCard
            key={r._id}
            request={r}
            reviewActions={
              canReview && r.status === "pending" ? (
                <ReviewActions requestId={r._id} />
              ) : undefined
            }
            deleteAction={
              canReview ? (
                <button
                  type="button"
                  onClick={() => setDeleteId(r._id)}
                  aria-label="Delete change request"
                  title="Delete request"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : undefined
            }
          />
        ))}
      </div>

      <ConfirmActionModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          deleteMutation.mutate(deleteId, {
            onSettled: () => setDeleteId(null),
          });
        }}
        isLoading={deleteMutation.isPending}
        title="Delete change request?"
        variant="danger"
        confirmLabel="Delete"
        description={
          <>
            This permanently removes the change-request record from the list and
            history. It does <strong>not</strong> revert any duty change that an
            earlier approval already applied. This action is recorded in the
            audit log.
          </>
        }
      />
    </div>
  );
}
