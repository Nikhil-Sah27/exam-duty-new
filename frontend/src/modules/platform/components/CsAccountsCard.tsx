import { useState } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import ConfirmActionModal from "@/shared/components/ConfirmActionModal";
import { useAddCsAccount, useResetCsPassword, useSetCsActive } from "../hooks";
import type { CsAccount, PlatformCollegeDetail } from "../types";
import CsAccountFields, { EMPTY_CS, csAccountError, generatePassword } from "./CsAccountFields";

/** The college's CS accounts: add, reset a password, deactivate / reactivate. */
export default function CsAccountsCard({ college }: { college: PlatformCollegeDetail }) {
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<CsAccount | null>(null);
  const [toggleFor, setToggleFor] = useState<CsAccount | null>(null);
  const setActive = useSetCsActive(college.id);
  const activeCount = college.csAccounts.filter((u) => u.isActive).length;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">CS accounts</h2>
          <p className="text-xs text-gray-500">The college's admins. They add and manage its teachers.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <UserPlus className="h-4 w-4" /> Add CS
        </button>
      </div>

      <ul className="divide-y divide-gray-100">
        {college.csAccounts.map((u) => (
          <li key={u._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className={`text-sm font-medium ${u.isActive ? "text-gray-800" : "text-gray-400 line-through"}`}>{u.name}</p>
              <p className="truncate text-xs text-gray-500">
                {u.email}
                {u.phone ? ` · ${u.phone}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {u.isActive && (
                <button
                  onClick={() => setResetFor(u)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Reset password
                </button>
              )}
              <button
                onClick={() => setToggleFor(u)}
                disabled={u.isActive && activeCount === 1}
                title={u.isActive && activeCount === 1 ? "Add another CS before deactivating the last one" : undefined}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                  u.isActive ? "text-red-600 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                {u.isActive ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <AddCsModal open={adding} onClose={() => setAdding(false)} collegeId={college.id} collegeName={college.name} />
      <ResetPasswordModal account={resetFor} onClose={() => setResetFor(null)} collegeId={college.id} />
      <ConfirmActionModal
        open={!!toggleFor}
        onClose={() => setToggleFor(null)}
        title={toggleFor?.isActive ? "Deactivate this CS?" : "Reactivate this CS?"}
        description={
          toggleFor?.isActive
            ? `${toggleFor?.name} won't be able to sign in to ${college.name} until reactivated.`
            : `${toggleFor?.name} will be able to sign in to ${college.name} again.`
        }
        confirmLabel={toggleFor?.isActive ? "Deactivate" : "Reactivate"}
        variant={toggleFor?.isActive ? "danger" : "primary"}
        isLoading={setActive.isPending}
        onConfirm={() =>
          toggleFor &&
          setActive.mutate({ userId: toggleFor._id, active: !toggleFor.isActive }, { onSettled: () => setToggleFor(null) })
        }
      />
    </section>
  );
}

function AddCsModal({ open, onClose, collegeId, collegeName }: { open: boolean; onClose: () => void; collegeId: string; collegeName: string }) {
  const add = useAddCsAccount(collegeId);
  const [cs, setCs] = useState(EMPTY_CS);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setCs(EMPTY_CS);
    setError(null);
    add.reset();
    onClose();
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = csAccountError(cs);
    if (problem) return setError(problem);
    setError(null);
    add.mutate({ ...cs, email: cs.email.trim(), name: cs.name.trim() }, { onSuccess: close });
  };
  const shown = error || (add.error as Error | null)?.message;
  return (
    <Modal open={open} onClose={close} title={`Add a CS to ${collegeName}`}>
      <form onSubmit={submit} className="space-y-4">
        <CsAccountFields idPrefix="add-cs" value={cs} onChange={setCs} />
        {shown && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{shown}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" isLoading={add.isPending}>
            Add CS
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ account, onClose, collegeId }: { account: CsAccount | null; onClose: () => void; collegeId: string }) {
  const reset = useResetCsPassword(collegeId);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const close = () => {
    setPassword("");
    setDone(false);
    reset.reset();
    onClose();
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || password.length < 6) return;
    reset.mutate({ userId: account._id, password }, { onSuccess: () => setDone(true) });
  };
  return (
    <Modal open={!!account} onClose={close} title={`New password for ${account?.name ?? ""}`}>
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Done. Share the new password with {account?.name} — their old one no longer works.
          </p>
          <p className="rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800">{password}</p>
          <div className="flex justify-end">
            <Button onClick={close}>Close</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex gap-2">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              aria-label="New password"
              autoComplete="new-password"
              className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              className="shrink-0 rounded border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Generate
            </button>
          </div>
          {reset.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{(reset.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" isLoading={reset.isPending} disabled={password.length < 6}>
              Set password
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
