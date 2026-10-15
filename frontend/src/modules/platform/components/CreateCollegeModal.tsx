import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "@/shared/components/Modal";
import Input from "@/shared/components/Input";
import Button from "@/shared/components/Button";
import type { CollegeFeatures } from "@/shared/lib/types";
import { useCreateCollege } from "../hooks";
import { FEATURE_LIST } from "../types";
import CsAccountFields, { EMPTY_CS, csAccountError } from "./CsAccountFields";
import FeatureToggle from "./FeatureToggle";

/** "RV College of Engineering" → "RVCOE": a starting point the superadmin can edit. */
const suggestCode = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

export default function CreateCollegeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateCollege();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [features, setFeatures] = useState<CollegeFeatures>({ cie: true, see: true });
  const [cs, setCs] = useState(EMPTY_CS);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setCode("");
    setCodeTouched(false);
    setFeatures({ cie: true, see: true });
    setCs(EMPTY_CS);
    setError(null);
    create.reset();
  };
  const close = () => {
    reset();
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = code.trim().toUpperCase();
    const problem = !name.trim()
      ? "Enter the college's name"
      : !/^[A-Z0-9-]{2,16}$/.test(finalCode)
      ? "Code: 2–16 letters, digits or dashes"
      : csAccountError(cs);
    if (problem) return setError(problem);
    setError(null);
    create.mutate(
      { name: name.trim(), code: finalCode, features, cs: { ...cs, email: cs.email.trim(), name: cs.name.trim() } },
      {
        onSuccess: (college) => {
          close();
          navigate(`/platform/colleges/${college.id}`);
        },
      }
    );
  };

  const shown = error || (create.error as Error | null)?.message;

  return (
    <Modal open={open} onClose={close} title="New college" size="lg">
      <form onSubmit={submit} className="space-y-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              id="college-name"
              label="College name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!codeTouched) setCode(suggestCode(e.target.value));
              }}
              autoFocus
            />
          </div>
          <Input
            id="college-code"
            label="Short code"
            value={code}
            onChange={(e) => {
              setCodeTouched(true);
              setCode(e.target.value.toUpperCase());
            }}
            placeholder="RVCE"
          />
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-800">Features</h3>
          <div className="divide-y divide-gray-100">
            {FEATURE_LIST.map((f) => (
              <FeatureToggle
                key={f.key}
                label={f.label}
                description={f.description}
                checked={features[f.key]}
                onChange={(next) => setFeatures((prev) => ({ ...prev, [f.key]: next }))}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-800">First CS (the college's admin)</h3>
          <p className="mb-3 text-xs text-gray-500">They sign in at proctavo.com and add the college's teachers.</p>
          <CsAccountFields idPrefix="first-cs" value={cs} onChange={setCs} />
        </section>

        {shown && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{shown}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" isLoading={create.isPending}>
            Create college
          </Button>
        </div>
      </form>
    </Modal>
  );
}
