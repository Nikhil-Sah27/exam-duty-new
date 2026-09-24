import { Users, UserCog, UserSearch } from "lucide-react";
import type { NotifyAudience } from "../types";

interface AudienceSelectorProps {
  value: NotifyAudience;
  onChange: (audience: NotifyAudience) => void;
}

const OPTIONS: {
  key: NotifyAudience;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    key: "all",
    label: "All Teachers",
    description: "Broadcast to every active user.",
    icon: Users,
  },
  {
    key: "role",
    label: "By Role",
    description: "Target CS, DCS, RS or Invigilators.",
    icon: UserCog,
  },
  {
    key: "specific",
    label: "Specific Teachers",
    description: "Pick individual recipients.",
    icon: UserSearch,
  },
];

export default function AudienceSelector({
  value,
  onChange,
}: AudienceSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              active
                ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-100"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Icon
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                active ? "text-blue-600" : "text-gray-400"
              }`}
            />
            <div>
              <div
                className={`text-sm font-semibold ${
                  active ? "text-blue-900" : "text-gray-800"
                }`}
              >
                {opt.label}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {opt.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
