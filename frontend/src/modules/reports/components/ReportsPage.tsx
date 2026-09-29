import { useState } from "react";
import DutyRosterReport from "./DutyRosterReport";
import DutyAnalyticsTable from "@/modules/duty-calculation/components/DutyAnalyticsTable";

type ReportTab = "roster" | "workload";

const TABS: { value: ReportTab; label: string }[] = [
  { value: "roster", label: "Duty Roster" },
  { value: "workload", label: "Teacher Workload" },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("roster");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          {tab === "roster"
            ? "Room-by-room invigilation roster for an exam — assignments, contacts, and vacancies."
            : "Duty targets and completion per teacher across the institution."}
        </p>
      </div>

      <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.value
                ? "bg-gray-800 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "roster" && <DutyRosterReport />}
      {tab === "workload" && <DutyAnalyticsTable enableExport />}
    </div>
  );
}
