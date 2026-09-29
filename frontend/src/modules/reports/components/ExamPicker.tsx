import { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ExamGroup } from "@/modules/exams/types";
import { getExamGroupStatus } from "@/modules/shared/exams/utils/examStatusUtils";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { sortExamsForPicker } from "../utils/sortExamsForPicker";
import ExamOptionContent from "./ExamOptionContent";
import ExamPickerOption from "./ExamPickerOption";

interface ExamPickerProps {
  groups: ExamGroup[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
}

/**
 * Custom exam selector replacing the native <select> so each exam can carry
 * colour-coded badges (a native <option> can't render markup). Exams render as
 * one flat list ordered ongoing → upcoming → completed, then by date then
 * semester; each row shows its own status pill rather than sitting under a
 * status section header. Trigger + rows reuse `ExamOptionContent` so the
 * selected exam looks identical to its list entry.
 */
export default function ExamPicker({
  groups,
  value,
  onChange,
  loading,
}: ExamPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const items = useMemo(() => sortExamsForPicker(groups), [groups]);
  const selected = groups.find((g) => g._id === value) ?? null;
  const selectedStatus = selected ? getExamGroupStatus(selected) : undefined;

  return (
    <div ref={ref} className="relative w-full sm:w-[32rem]">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-gray-300"
      >
        {selected ? (
          <ExamOptionContent exam={selected} status={selectedStatus} />
        ) : (
          <span className="text-gray-500">
            {loading ? "Loading exams…" : "Select an exam"}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 max-h-96 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
        >
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">
              {loading ? "Loading exams…" : "No exams available."}
            </p>
          ) : (
            <div className="space-y-1">
              {items.map(({ exam, status }) => (
                <ExamPickerOption
                  key={exam._id}
                  exam={exam}
                  status={status}
                  selected={exam._id === value}
                  onSelect={() => {
                    onChange(exam._id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
