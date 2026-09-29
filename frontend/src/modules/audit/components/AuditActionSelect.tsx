import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { ACTION_META } from "../utils/auditDisplay";

/** Solid dot colour per badge tone, echoing each action's badge in the table. */
const TONE_DOT: Record<string, string> = {
  emerald: "#10b981",
  blue: "#3b82f6",
  indigo: "#6366f1",
  amber: "#f59e0b",
  red: "#ef4444",
  gray: "#9ca3af",
};

export interface AuditActionOption {
  value: string;
  label: string;
}

export interface AuditActionGroup {
  label: string;
  options: AuditActionOption[];
}

/** Tone of an option's first action (a value may be a comma-separated list). */
function dotColor(value: string): string {
  const first = value.split(",")[0];
  const tone = ACTION_META[first]?.tone ?? "gray";
  return TONE_DOT[tone] ?? TONE_DOT.gray;
}

/**
 * Custom replacement for the native action-filter <select> so the dropdown can
 * carry group headers and a colour dot per action (matching the log's badges) —
 * things a native <option> can't render. Behaviour mirrors the ExamPicker: click
 * to open, click-outside to close, one selection.
 */
export default function AuditActionSelect({
  value,
  onChange,
  groups,
}: {
  value: string;
  onChange: (value: string) => void;
  groups: AuditActionGroup[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const selectedLabel = useMemo(() => {
    if (!value) return "All actions";
    for (const g of groups) {
      const found = g.options.find((o) => o.value === value);
      if (found) return found.label;
    }
    return "All actions";
  }, [value, groups]);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-48 items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300"
      >
        <span className="flex min-w-0 items-center gap-2">
          {value && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: dotColor(value) }}
            />
          )}
          <span className="truncate">{selectedLabel}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-60 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
        >
          <OptionRow
            label="All actions"
            selected={!value}
            onClick={() => select("")}
          />
          {groups.map((g) => (
            <div key={g.label} className="mt-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {g.label}
              </div>
              {g.options.map((o) => (
                <OptionRow
                  key={o.value}
                  label={o.label}
                  dot={dotColor(o.value)}
                  selected={value === o.value}
                  onClick={() => select(o.value)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  label,
  dot,
  selected,
  onClick,
}: {
  label: string;
  dot?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
        selected
          ? "bg-indigo-50 text-indigo-700"
          : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: dot ?? "transparent" }}
      />
      <span className="flex-1 truncate">{label}</span>
      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
    </button>
  );
}
