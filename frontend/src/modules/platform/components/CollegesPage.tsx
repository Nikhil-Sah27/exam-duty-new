import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { useColleges } from "../hooks";
import CreateCollegeModal from "./CreateCollegeModal";
import FeatureChips, { StatusChip } from "./FeatureChips";

export default function CollegesPage() {
  const { data: colleges, isLoading, isError, error } = useColleges();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Colleges</h1>
          <p className="mt-1 text-sm text-gray-500">
            Each college is separate — its own CS, teachers, rooms and exams.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New college
        </button>
      </div>

      {isLoading && <p className="text-gray-500">Loading colleges…</p>}
      {isError && <p className="text-red-600">Error: {(error as Error).message}</p>}

      {colleges && colleges.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
          <Building2 className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm text-gray-500">No colleges yet.</p>
        </div>
      )}

      {colleges && colleges.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-gray-100 bg-gray-50/80">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-5 py-3">College</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Features</th>
                <th className="px-5 py-3 text-right">Teachers</th>
                <th className="px-5 py-3 text-right">Exams</th>
                <th className="px-5 py-3 text-right">Upcoming duties</th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/platform/colleges/${c.id}`)}
                  className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    <p className="font-mono text-xs text-gray-400">{c.code}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusChip status={c.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <FeatureChips features={c.features} />
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums text-gray-700">{c.counts.teachers}</td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums text-gray-700">{c.counts.exams}</td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums text-gray-700">{c.counts.upcomingDuties}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateCollegeModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
