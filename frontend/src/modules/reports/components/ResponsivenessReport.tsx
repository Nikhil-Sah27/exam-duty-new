import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Users, X } from "lucide-react";
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

type StatusFilter = "" | "not_responding" | "awaiting" | "below_target" | "ok";
type SortKey = "priority" | "name" | "awaiting" | "oldest" | "slowest" | "inactive";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "not_responding", label: "Not responding" },
  { value: "awaiting", label: "Awaiting confirmation" },
  { value: "below_target", label: "Below selection target" },
  { value: "ok", label: "OK" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Sort: needs attention first" },
  { value: "name", label: "Sort: name A–Z" },
  { value: "awaiting", label: "Sort: most awaiting" },
  { value: "oldest", label: "Sort: longest waiting" },
  { value: "slowest", label: "Sort: slowest to confirm" },
  { value: "inactive", label: "Sort: least recently active" },
];

const EMPTY_FILTERS = { search: "", department: "", role: "", designation: "", status: "" as StatusFilter };

const matchesStatus = (r: ResponsivenessRow, s: StatusFilter) => {
  if (s === "not_responding") return r.notResponding;
  if (s === "awaiting") return r.awaiting > 0;
  if (s === "below_target") return r.target > 0 && r.selected < r.target;
  if (s === "ok") return !r.notResponding;
  return true;
};

const time = (iso: string | null, missing: number) => (iso ? new Date(iso).getTime() : missing);

const SORTERS: Record<SortKey, (a: ResponsivenessRow, b: ResponsivenessRow) => number> = {
  // The server already orders by "needs attention" — keep it.
  priority: () => 0,
  name: (a, b) => a.name.localeCompare(b.name),
  awaiting: (a, b) => b.awaiting - a.awaiting,
  oldest: (a, b) => time(a.oldestAwaitingSince, Infinity) - time(b.oldestAwaitingSince, Infinity),
  slowest: (a, b) => (b.avgConfirmHours ?? -1) - (a.avgConfirmHours ?? -1),
  inactive: (a, b) => time(a.lastActiveAt, 0) - time(b.lastActiveAt, 0),
};

const selectClass =
  "rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Tile({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Showing these — click to show everyone" : "Show only these"}
      className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-indigo-300 ${
        active ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200"
      }`}
    >
      <div className={`rounded-lg p-2 ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </button>
  );
}

/**
 * Reports → Responsiveness (REMINDERS_PLAN.md §D). Confirmation is the signal —
 * email opens aren't tracked because they can't be measured reliably. Counts are
 * duty units: an RS/DCS group is one duty.
 */
export default function ResponsivenessReport() {
  const { data, isLoading, error } = useResponsiveness();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("priority");
  const update = (patch: Partial<typeof EMPTY_FILTERS>) => setFilters((f) => ({ ...f, ...patch }));
  const toggleStatus = (s: StatusFilter) => update({ status: filters.status === s ? "" : s });

  const all = useMemo(() => data?.teachers ?? [], [data]);
  const options = useMemo(() => {
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort();
    return {
      departments: uniq(all.map((r) => r.department)),
      designations: uniq(all.map((r) => r.designation)),
      roles: uniq(all.flatMap((r) => r.roles)),
    };
  }, [all]);

  const rows = useMemo<ResponsivenessRow[]>(() => {
    const q = filters.search.trim().toLowerCase();
    const list = all.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q)) &&
        (!filters.department || r.department === filters.department) &&
        (!filters.designation || r.designation === filters.designation) &&
        (!filters.role || r.roles.includes(filters.role)) &&
        matchesStatus(r, filters.status)
    );
    return sort === "priority" ? list : [...list].sort(SORTERS[sort]);
  }, [all, filters, sort]);

  const filtered = Object.values(filters).some(Boolean) || sort !== "priority";

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Users} label="Teachers" value={data.summary.teachers} tone="bg-indigo-50 text-indigo-600" active={!filters.status} onClick={() => update({ status: "" })} />
        <Tile icon={AlertTriangle} label="Not responding" value={data.summary.notResponding} tone="bg-red-50 text-red-600" active={filters.status === "not_responding"} onClick={() => toggleStatus("not_responding")} />
        <Tile icon={Clock} label="Duties awaiting confirmation" value={data.summary.awaitingConfirmation} tone="bg-amber-50 text-amber-600" active={filters.status === "awaiting"} onClick={() => toggleStatus("awaiting")} />
        <Tile icon={CheckCircle2} label="Below selection target" value={data.summary.belowTarget} tone="bg-blue-50 text-blue-600" active={filters.status === "below_target"} onClick={() => toggleStatus("below_target")} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className={`w-full sm:w-64 ${selectClass}`}
        />
        <select value={filters.department} onChange={(e) => update({ department: e.target.value })} className={selectClass}>
          <option value="">All departments</option>
          {options.departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={filters.role} onChange={(e) => update({ role: e.target.value })} className={selectClass}>
          <option value="">All roles</option>
          {options.roles.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
        <select value={filters.designation} onChange={(e) => update({ designation: e.target.value })} className={selectClass}>
          <option value="">All designations</option>
          {options.designations.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => update({ status: e.target.value as StatusFilter })} className={selectClass}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectClass}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setSort("priority");
            }}
            className="inline-flex items-center gap-1 rounded px-2 py-2 text-sm text-gray-500 hover:text-gray-800"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          Showing {rows.length} of {all.length}
        </span>
      </div>

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
                  {all.length === 0 ? "No teachers with duty roles." : "No teachers match these filters."}
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
