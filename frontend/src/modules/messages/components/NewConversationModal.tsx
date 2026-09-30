import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Search } from "lucide-react";
import Modal from "@/shared/components/Modal";
import { fetchUsers } from "@/modules/users/services";
import type { UserProfile } from "@/modules/users/types";
import { ROLE_LABELS } from "@/shared/constants/roles";
import { initials } from "../utils/format";

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen teacher's id; parent starts + opens the thread. */
  onSelect: (teacherId: string) => void;
  /** Id of the teacher whose conversation is currently being opened. */
  startingId?: string | null;
  /** Error message from a failed start attempt, shown as a banner. */
  errorMessage?: string | null;
}

// A teacher is any non-CS account (Invigilator / RS / DCS). CS can't message
// themselves or another controller through a "teacher" thread.
const isTeacher = (u: UserProfile) => !u.roles.includes("cs");

const roleSummary = (u: UserProfile) =>
  u.roles
    .filter((r) => r !== "cs")
    .map((r) => ROLE_LABELS[r] ?? r)
    .join(" · ");

/** CS-only: pick any teacher to start (or reopen) a direct conversation. */
export default function NewConversationModal({
  open,
  onClose,
  onSelect,
  startingId,
  errorMessage,
}: NewConversationModalProps) {
  const busy = Boolean(startingId);
  const [term, setTerm] = useState("");
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users", { includeInactive: false }],
    queryFn: () => fetchUsers(),
    enabled: open,
  });

  const teachers = useMemo(() => {
    const q = term.trim().toLowerCase();
    return users
      .filter(isTeacher)
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, term]);

  return (
    <Modal open={open} onClose={onClose} title="New message">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search teachers by name, email or department"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading teachers…
            </div>
          ) : teachers.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              No teachers found.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {teachers.map((t) => (
                <li key={t._id}>
                  <button
                    disabled={busy}
                    onClick={() => onSelect(t._id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      {initials(t.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {t.name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {[roleSummary(t), t.department].filter(Boolean).join(" · ") ||
                          t.email}
                      </p>
                    </div>
                    {startingId === t._id && (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
