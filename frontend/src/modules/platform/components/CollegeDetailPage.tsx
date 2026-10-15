import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import Modal from "@/shared/components/Modal";
import Input from "@/shared/components/Input";
import Button from "@/shared/components/Button";
import ConfirmActionModal from "@/shared/components/ConfirmActionModal";
import type { CollegeFeatures } from "@/shared/lib/types";
import { useCollege, useUpdateCollege } from "../hooks";
import { FEATURE_LIST, type PlatformCollegeDetail } from "../types";
import { StatusChip } from "./FeatureChips";
import FeatureToggle from "./FeatureToggle";
import CsAccountsCard from "./CsAccountsCard";

export default function CollegeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: college, isLoading, isError, error } = useCollege(id);

  if (isLoading) return <p className="text-gray-500">Loading college…</p>;
  if (isError || !college) return <p className="text-red-600">Error: {(error as Error | null)?.message || "Not found"}</p>;
  return <CollegeDetail college={college} />;
}

function CollegeDetail({ college }: { college: PlatformCollegeDetail }) {
  const update = useUpdateCollege(college.id);
  const [renaming, setRenaming] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [turningOff, setTurningOff] = useState<keyof CollegeFeatures | null>(null);
  const suspended = college.status === "suspended";

  const setFeature = (key: keyof CollegeFeatures, value: boolean) => update.mutate({ features: { [key]: value } });
  const offLabel = FEATURE_LIST.find((f) => f.key === turningOff)?.label;

  return (
    <div className="space-y-6">
      <Link to="/platform" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> All colleges
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-800">{college.name}</h1>
            <StatusChip status={college.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-gray-400">{college.code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRenaming(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" /> Rename
          </button>
          <button
            onClick={() => setConfirmStatus(true)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              suspended ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-red-200 bg-white text-red-600 hover:bg-red-50"
            }`}
          >
            {suspended ? "Reactivate college" : "Suspend college"}
          </button>
        </div>
      </div>

      {suspended && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Suspended — nobody in this college can sign in. Its data is kept as it was.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Teachers & staff", college.counts.teachers],
          ["Exams", college.counts.exams],
          ["Upcoming duty slots", college.counts.upcomingDuties],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-800">{n}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Features</h2>
        <p className="text-xs text-gray-500">
          A switched-off exam type disappears for this college — its exams, duties, reminders and phone alarms. Nothing is
          deleted; switching it back on restores everything.
        </p>
        <div className="mt-2 divide-y divide-gray-100">
          {FEATURE_LIST.map((f) => (
            <FeatureToggle
              key={f.key}
              label={f.label}
              description={f.description}
              checked={college.features[f.key]}
              disabled={update.isPending}
              onChange={(next) => (next ? setFeature(f.key, true) : setTurningOff(f.key))}
            />
          ))}
        </div>
        {update.error && <p className="mt-2 text-sm text-red-600">{(update.error as Error).message}</p>}
      </section>

      <CsAccountsCard college={college} />

      <RenameModal open={renaming} onClose={() => setRenaming(false)} college={college} />

      <ConfirmActionModal
        open={!!turningOff}
        onClose={() => setTurningOff(null)}
        title={`Turn off ${offLabel} for ${college.name}?`}
        description={`Its ${offLabel} and their duties disappear from every page in this college — lists, Select Duty, reminders, phone alarms and calendar invites. Nothing is deleted: turning it back on brings them back.`}
        confirmLabel="Turn off"
        variant="warning"
        isLoading={update.isPending}
        onConfirm={() => turningOff && update.mutate({ features: { [turningOff]: false } }, { onSettled: () => setTurningOff(null) })}
      />

      <ConfirmActionModal
        open={confirmStatus}
        onClose={() => setConfirmStatus(false)}
        title={suspended ? `Reactivate ${college.name}?` : `Suspend ${college.name}?`}
        description={
          suspended
            ? "Its CS and teachers can sign in again, with everything as they left it."
            : "Everyone in this college is signed out and can't sign in until you reactivate it. Reminders and alarms for its duties stop. Nothing is deleted."
        }
        confirmLabel={suspended ? "Reactivate" : "Suspend"}
        variant={suspended ? "primary" : "danger"}
        isLoading={update.isPending}
        onConfirm={() =>
          update.mutate({ status: suspended ? "active" : "suspended" }, { onSettled: () => setConfirmStatus(false) })
        }
      />
    </div>
  );
}

function RenameModal({ open, onClose, college }: { open: boolean; onClose: () => void; college: PlatformCollegeDetail }) {
  const update = useUpdateCollege(college.id);
  const [name, setName] = useState(college.name);
  const [code, setCode] = useState(college.code);
  const close = () => {
    setName(college.name);
    setCode(college.code);
    update.reset();
    onClose();
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({ name: name.trim(), code: code.trim().toUpperCase() }, { onSuccess: onClose });
  };
  return (
    <Modal open={open} onClose={close} title="Rename college">
      <form onSubmit={submit} className="space-y-4">
        <Input id="rename-name" label="College name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input id="rename-code" label="Short code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        {update.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{(update.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" isLoading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
