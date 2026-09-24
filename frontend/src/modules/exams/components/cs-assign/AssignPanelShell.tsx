import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Common chrome for a role assignment sub-view inside the room-detail modal:
 * a back arrow + title header, then arbitrary content. Keeps the three role
 * panels visually identical and lets the modal swap them in place.
 */
export default function AssignPanelShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <h4 className="text-sm font-bold text-gray-800">{title}</h4>
      {children}
    </div>
  );
}

/** Blue-tinted read-only summary box used to state WHO/WHAT/WHERE/WHEN. */
export function AssignContextCard({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5">
      <dl className="grid grid-cols-1 gap-1.5 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="w-24 shrink-0 text-gray-400">{label}</dt>
            <dd className="font-medium text-gray-700">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
