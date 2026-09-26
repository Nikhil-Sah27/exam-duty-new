import { useState, useCallback, useMemo } from "react";
import type { CIEConfig, DepartmentData, Shift } from "../types";
import {
  calculateExamStats,
  type ExamStats,
} from "../services/examScheduling";

const DEFAULT_SHIFTS: Shift[] = [
  { name: "Morning", startTime: "09:30", endTime: "11:00" },
  { name: "Afternoon", startTime: "14:00", endTime: "15:30" },
];

export const INITIAL_CONFIG: CIEConfig = {
  departmentIds: [],
  semester: "",
  examType: "IA1",
  avgStudentsPerClass: 40,
  shifts: DEFAULT_SHIFTS,
  startDate: "",
  endDate: "",
};

const EMPTY_STATS: ExamStats = {
  maxCourses: 0,
  shiftsPerDay: 0,
  requiredDays: 0,
  totalSlots: 0,
  extraSlots: 0,
};

export function useExamConfig() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<CIEConfig>(INITIAL_CONFIG);
  const [departmentsData, setDepartmentsData] = useState<DepartmentData[]>([]);

  const nextStep = useCallback(() => setStep((s) => Math.min(s + 1, 3)), []);
  const prevStep = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);
  const goToStep = useCallback((s: number) => setStep(s), []);

  const updateConfig = useCallback(
    (patch: Partial<CIEConfig>) => setConfig((c) => ({ ...c, ...patch })),
    []
  );

  const toggleDepartment = useCallback((id: string) => {
    setConfig((c) => {
      const ids = c.departmentIds.includes(id)
        ? c.departmentIds.filter((d) => d !== id)
        : [...c.departmentIds, id];
      return { ...c, departmentIds: ids };
    });
  }, []);

  const addShift = useCallback(() => {
    setConfig((c) => ({
      ...c,
      shifts: [...c.shifts, { name: "", startTime: "", endTime: "" }],
    }));
  }, []);

  const updateShift = useCallback((index: number, patch: Partial<Shift>) => {
    setConfig((c) => {
      const shifts = [...c.shifts];
      shifts[index] = { ...shifts[index], ...patch };
      return { ...c, shifts };
    });
  }, []);

  const removeShift = useCallback((index: number) => {
    setConfig((c) => ({
      ...c,
      shifts: c.shifts.filter((_, i) => i !== index),
    }));
  }, []);

  const examStats = useMemo<ExamStats>(() => {
    if (departmentsData.length === 0 || config.shifts.length === 0) return EMPTY_STATS;
    return calculateExamStats(departmentsData, config.shifts);
  }, [departmentsData, config.shifts]);

  const reset = useCallback(() => {
    setStep(0);
    setConfig(INITIAL_CONFIG);
    setDepartmentsData([]);
  }, []);

  return {
    step,
    config,
    departmentsData,
    examStats,

    setConfig,
    setDepartmentsData,
    nextStep,
    prevStep,
    goToStep,
    updateConfig,
    toggleDepartment,
    addShift,
    updateShift,
    removeShift,
    reset,
  };
}
