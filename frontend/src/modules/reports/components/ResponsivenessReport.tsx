import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Users } from "lucide-react";
import { useResponsiveness, type ResponsivenessRow } from "../hooks/useResponsiveness";

const ROLE_LABEL: Record<string, string> = { invigilator: "Invigilator", rs: "RS", dcs: "DCS" };

/** "3h ago", "2d ago", "—" */
function ago(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "just now";
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Tile({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className={`rounded-lg p-2 ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

/**
 * Reports → Responsiveness (REMINDERS_PLAN.md §D). Confirmation is the signal —
 * email opens aren't tracked because they can't be measured reliably. Counts are
 * duty units: an RS/DCS group is one duty.
 */
export default function ResponsivenessReport() {
  const { data, isLoading, error } = useResponsiveness();
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const rows = useMemo<ResponsivenessRow[]>(
    () => (data?.teachers ?? []).filter((r) => !onlyFlagged || r.notResponding),
    [data, onlyFlagged]
  );

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Users} label="Teachers" value={data.summary.teachers} tone="bg-indigo-50 text-indigo-600" />
        <Tile icon={AlertTriangle} label="Not responding" value={data.summary.notResponding} tone="bg-red-50 text-red-600" />
        <Tile icon={Clock} label="Duties awaiting confirmation" value={data.summary.awaitingConfirmation} tone="bg-amber-50 text-amber-600" />
        <Tile icon={CheckCircle2} label="Below selection target" value={data.summary.belowTarget} tone="bg-blue-50 text-blue-600" />
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} className="h-4 w-4 rounded" />
        Show only teachers who aren't responding
      </label>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50/50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Teacher</th>
              <th className="px-4 py-3">Upcoming</th>
              <th className="px-4 py-3">Confirmed</th>
              <th className="px-4 py-3">Awaiting</th>
              <th className="px-4 py-3">Avg. time to confirm</th>
              <th className="px-4 py-3">Selected / target</th>
              <th className="px-4 py-3">Reminders</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                  {onlyFlagged ? "Everyone is responding." : "No teachers with duty roles."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.teacherId} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <Link to={`/manage-duties/${r.teacherId}`} className="font-medium text-gray-900 hover:text-indigo-600">
                    {r.name}
                  </Link>
                  <div className="text-xs text-gray-400">
                    {[r.designation, r.roles.map((x) => ROLE_LABEL[x] ?? x).join(", ")].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{r.upcoming}</td>
                <td className="px-4 py-3 text-gray-700">{r.confirmed}</td>
                <td className="px-4 py-3">
                  {r.awaiting > 0 ? (
                    <span className="font-semibold text-amber-700">
                      {r.awaiting}
                      <span className="ml-1 text-xs font-normal text-gray-400">oldest {ago(r.oldestAwaitingSince)}</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{r.avgConfirmHours == null ? "—" : `${r.avgConfirmHours}h`}</td>
                <td className="px-4 py-3">
                  {r.target > 0 ? (
                    <span className={r.selected < r.target ? "font-semibold text-blue-700" : "text-gray-700"}>
                      {r.selected} / {r.target}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{r.nudges}</td>
                <td className="px-4 py-3 text-gray-600">{ago(r.lastActiveAt)}</td>
                <td className="px-4 py-3">
                  {r.notResponding ? (
                    <span title={r.reasons.join("; ")} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                      <AlertTriangle className="h-3 w-3" /> Not responding
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      OK
                    </span>
                  )}
                  {r.reasons.length > 0 && <p className="mt-1 text-[11px] text-gray-400">{r.reasons.join("; ")}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
