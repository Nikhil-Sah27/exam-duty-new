import { useState } from "react";
import DutyRosterReport from "./DutyRosterReport";
import ResponsivenessReport from "./ResponsivenessReport";
import DutyAnalyticsTable from "@/modules/duty-calculation/components/DutyAnalyticsTable";

type ReportTab = "roster" | "workload" | "responsiveness";

const TABS: { value: ReportTab; label: string }[] = [
  { value: "roster", label: "Duty Roster" },
  { value: "workload", label: "Teacher Workload" },
  { value: "responsiveness", label: "Responsiveness" },
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
            : tab === "workload"
              ? "Duty targets and completion per teacher across the institution."
              : "Who is confirming their duties and selecting enough of them — and who isn't."}
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1.5 w-fit shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-lg px-6 py-2.5 text-base font-semibold transition-all ${
              tab === t.value
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "roster" && <DutyRosterReport />}
      {tab === "workload" && <DutyAnalyticsTable enableExport />}
      {tab === "responsiveness" && <ResponsivenessReport />}
    </div>
  );
}
