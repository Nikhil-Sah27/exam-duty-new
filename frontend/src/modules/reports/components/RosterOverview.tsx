import { Loader2 } from "lucide-react";
import { useRosterOverview } from "../hooks/useRosterOverview";
import RosterCoverageCharts from "./RosterCoverageCharts";
import RoleCompletionBars from "./RoleCompletionBars";
import LowCompletionTeachers from "./LowCompletionTeachers";

/**
 * Institution-wide analytics shown on the Reports → Duty Roster tab before any
 * exam is picked: class-coverage pies, then per-role completion bars, then the
 * below-target teacher list. Orchestration only — each block is its own
 * component and the data comes from one shared hook.
 */
export default function RosterOverview() {
  const { coverage, roleCompletion, teachers, isLoading, error } =
    useRosterOverview();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Building institution overview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load the institution overview.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title="Class coverage & assignment"
        subtitle="How exam classes are covered across all exams, and who assigned them."
      >
        <RosterCoverageCharts coverage={coverage} />
      </Section>

      <Section
        title="Duty completion by role"
        subtitle="Completed vs. target duties for each role, institution-wide."
      >
        <RoleCompletionBars roles={roleCompletion} />
      </Section>

      <Section
        title="Follow-up"
        subtitle="Teachers who haven't met their target — adjust the cutoff as needed."
      >
        <LowCompletionTeachers teachers={teachers} />
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
