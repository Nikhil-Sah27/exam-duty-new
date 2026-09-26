import { ArrowLeft, ArrowRight } from "lucide-react";
import Button from "@/shared/components/Button";
import type { DepartmentData, RoutineEntry, Shift } from "../../types";
import { formatDate } from "../../utils/dateUtils";
import {
  getSameCodeSlotConflicts,
  getConflictingAssignmentKeys,
} from "../../selectors/routineSelectors";
import {
  buildRoutineOptions,
  isTokenUsedInRoutine,
} from "../../utils/routineOptionUtils";
import SameCodeConflictBanner from "../routine/SameCodeConflictBanner";

interface RoutineStepProps {
  routine: RoutineEntry[];
  departmentsData: DepartmentData[];
  shifts: Shift[];
  onUpdateAssignment: (entryIndex: number, departmentId: string, token: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function RoutineStep({
  routine,
  departmentsData,
  shifts,
  onUpdateAssignment,
  onNext,
  onPrev,
}: RoutineStepProps) {
  const conflicts = getSameCodeSlotConflicts(routine, departmentsData);
  const flaggedCells = getConflictingAssignmentKeys(routine, departmentsData);

  return (
    <div className="space-y-6">
      <SameCodeConflictBanner conflicts={conflicts} shifts={shifts} />
      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-600">
                  Date
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-600">
                  Shift
                </th>
                {departmentsData.map((dept) => (
                  <th
                    key={dept._id}
                    className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-600"
                  >
                    {dept.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routine.map((entry, entryIndex) => {
                const shift = shifts[entry.shiftIndex];
                return (
                  <tr key={`${entry.date}-${entry.shiftIndex}`} className="border-b border-gray-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                      {formatDate(entry.date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                        {shift?.name || `Shift ${entry.shiftIndex + 1}`}
                      </span>
                    </td>
                    {departmentsData.map((dept) => {
                      const selectedToken = entry.assignments[dept._id] || "";
                      // Decorate each option with its "already used elsewhere"
                      // state, then sink used options to the bottom so unused
                      // choices stay at the top of the dropdown.
                      const options = buildRoutineOptions(dept)
                        .map((opt) => ({
                          opt,
                          alreadyUsed:
                            selectedToken !== opt.token &&
                            isTokenUsedInRoutine(routine, dept._id, opt.token),
                        }))
                        .sort(
                          (a, b) => Number(a.alreadyUsed) - Number(b.alreadyUsed),
                        );
                      const isFlagged =
                        !!selectedToken &&
                        flaggedCells.has(`${dept._id}::${selectedToken}`);
                      return (
                        <td key={dept._id} className="px-4 py-2.5">
                          <select
                            value={selectedToken}
                            onChange={(e) =>
                              onUpdateAssignment(entryIndex, dept._id, e.target.value)
                            }
                            title={
                              isFlagged
                                ? "Another department has a course with the same code on a different date/shift"
                                : undefined
                            }
                            className={`w-full min-w-[160px] rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                              isFlagged
                                ? "border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-500 focus:ring-amber-400"
                                : "border-gray-200 text-gray-700 focus:border-blue-500 focus:ring-blue-500"
                            }`}
                          >
                            <option value="">— Select —</option>
                            {options.map(({ opt, alreadyUsed }) => {
                              const groupSuffix =
                                opt.kind === "group"
                                  ? ` (${opt.memberCourseIds.length} subject${opt.memberCourseIds.length !== 1 ? "s" : ""})`
                                  : "";
                              return (
                                <option
                                  key={opt.token}
                                  value={opt.token}
                                  disabled={alreadyUsed}
                                  // Used courses are non-selectable and tinted a
                                  // light red so they read as unavailable.
                                  style={
                                    alreadyUsed
                                      ? {
                                          backgroundColor: "#fee2e2",
                                          color: "#b91c1c",
                                        }
                                      : undefined
                                  }
                                >
                                  {opt.label}
                                  {groupSuffix}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Navigation */}
      <div className="sticky bottom-0 flex justify-between border-t border-gray-100 bg-gray-50/80 px-1 py-4 backdrop-blur">
        <Button variant="secondary" onClick={onPrev}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Continue to Summary <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
