import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { useAuditLogs } from "../hooks/useAuditLogs";
import { ACTION_META, BADGE_TONES, summarizeDetails } from "../utils/auditDisplay";
import type { AuditLogEntry } from "../types";
import AuditActionSelect from "./AuditActionSelect";

const PAGE_SIZE = 25;

// Grouped options for the action filter — keeps the dropdown scannable. Notes:
//  - Teacher self-claims (SELF_ASSIGN_* / CLAIM_DCS_GROUP) are omitted: the
//    backend hides them, so filtering by them would return nothing.
//  - "Duty assigned by CS" covers every CS admin-assign action — single duty, RS
//    group, and DCS group (the value is a comma list the backend matches with
//    $in) — so they all filter together under one option.
//  - "Duty unassigned by CS" likewise covers single, RS-group and DCS-group
//    unassigns. A teacher's own cancellation (CANCEL_DUTY) isn't offered.
const ACTION_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: "Duties",
    options: [
      {
        value: "ADMIN_ASSIGN_DUTY,ADMIN_ASSIGN_DUTY_GROUP,ADMIN_CLAIM_DCS_GROUP",
        label: "Duty assigned by CS",
      },
      {
        value: "ADMIN_UNASSIGN_DUTY,ADMIN_UNASSIGN_DUTY_GROUP",
        label: "Duty unassigned by CS",
      },
    ],
  },
  {
    label: "Change Requests",
    options: [
      { value: "SUBMIT_CHANGE_REQUEST", label: "Change request submitted" },
      { value: "APPROVE_CHANGE_REQUEST", label: "Change request approved" },
      { value: "REJECT_CHANGE_REQUEST", label: "Change request rejected" },
      { value: "DELETE_CHANGE_REQUEST", label: "Change request deleted" },
    ],
  },
  {
    label: "Exams",
    options: [
      { value: "CREATE_EXAM", label: "Exam created" },
      { value: "DELETE_EXAM", label: "Exam deleted" },
    ],
  },
  {
    label: "Teachers",
    options: [
      { value: "CREATE_USER", label: "Teacher created" },
      { value: "UPDATE_USER", label: "Teacher updated" },
      { value: "DEACTIVATE_USER", label: "Teacher deactivated" },
      { value: "REACTIVATE_USER", label: "Teacher reactivated" },
    ],
  },
  { label: "Announcements", options: [{ value: "SEND_BROADCAST", label: "Announcement sent" }] },
];

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error, isFetching } = useAuditLogs({
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const entries = data?.data ?? [];
  const pages = data?.pages ?? 1;

  const resetFilters = () => {
    setAction("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Who did what, and when — every duty assignment, change-request decision,
          exam change, and teacher-account change across the institution.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Filters
        </label>

        <AuditActionSelect
          value={action}
          onChange={(v) => {
            setAction(v);
            setPage(1);
          }}
          groups={ACTION_GROUPS}
        />

        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
          aria-label="From date"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
          aria-label="To date"
        />

        {(action || from || to) && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}

        {data && (
          <span className="ml-auto text-xs text-gray-400">
            {data.total} entr{data.total === 1 ? "y" : "ies"}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading audit log…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load the audit log.
        </div>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500">No audit entries match the current filters.</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className={`overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm ${isFetching ? "opacity-70" : ""}`}>
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">By</th>
                <th className="px-4 py-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <Row key={e._id} entry={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ entry }: { entry: AuditLogEntry }) {
  const meta = ACTION_META[entry.action] ?? { label: entry.action, tone: "gray" };
  const badge = BADGE_TONES[meta.tone] ?? BADGE_TONES.gray;
  const when = new Date(entry.createdAt);
  const actorRole =
    typeof entry.details?.actorRole === "string" ? entry.details.actorRole : null;
  const summary = summarizeDetails(entry);

  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-2 align-top">
        <div className="text-gray-700">
          {when.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
        <div className="text-[11px] text-gray-400">
          {when.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-2 align-top">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badge}`}
        >
          {meta.label}
        </span>
      </td>
      <td className="px-4 py-2 align-top">
        <div className="font-semibold text-gray-800">
          {entry.performedBy?.name ?? "Unknown user"}
          {actorRole && (
            <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
              {actorRole}
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-400">{entry.performedBy?.email ?? ""}</div>
      </td>
      <td className="px-4 py-2 align-top text-gray-600">
        {summary || <span className="text-gray-400">—</span>}
      </td>
    </tr>
  );
}
