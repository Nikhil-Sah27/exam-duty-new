import type { RosterCoverage } from "../hooks/useRosterOverview";
import PieChart from "./PieChart";

interface RosterCoverageChartsProps {
  coverage: RosterCoverage;
}

// Fixed palette so the same concept keeps its color across both pies.
const COLOR = {
  cs: "#6366f1", // indigo — assigned by CS
  self: "#14b8a6", // teal — self-claimed by teachers
  assigned: "#10b981", // emerald — any assigned class
  vacant: "#f59e0b", // amber — unfilled class
};

/**
 * The two class-coverage pies for the Reports overview: how classes are covered
 * (assigned vs vacant) and, of the assigned ones, who assigned them (CS vs the
 * teachers themselves). Both are computed over invigilator class (room) slots.
 */
export default function RosterCoverageCharts({
  coverage,
}: RosterCoverageChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <PieChart
        title="Class coverage"
        slices={[
          { label: "Assigned", value: coverage.assigned, color: COLOR.assigned },
          { label: "Vacant", value: coverage.vacant, color: COLOR.vacant },
        ]}
      />
      <PieChart
        title="Assignment source"
        slices={[
          { label: "Assigned by CS", value: coverage.assignedCs, color: COLOR.cs },
          {
            label: "Self-claimed by teachers",
            value: coverage.assignedSelf,
            color: COLOR.self,
          },
        ]}
      />
    </div>
  );
}
