import { useQuery } from "@tanstack/react-query";
import api from "@/shared/lib/api";

export interface ResponsivenessRow {
  teacherId: string;
  name: string;
  email: string | null;
  department: string | null;
  designation: string | null;
  roles: string[];
  target: number;
  selected: number;
  upcoming: number;
  confirmed: number;
  awaiting: number;
  oldestAwaitingSince: string | null;
  avgConfirmHours: number | null;
  nudges: number;
  lastActiveAt: string | null;
  notResponding: boolean;
  reasons: string[];
}

export interface ResponsivenessReport {
  generatedAt: string;
  summary: { teachers: number; notResponding: number; awaitingConfirmation: number; belowTarget: number };
  teachers: ResponsivenessRow[];
}

/** CS-only: who is and isn't confirming or selecting duties. */
export const useResponsiveness = () =>
  useQuery({
    queryKey: ["reports", "responsiveness"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ResponsivenessReport }>("/reports/responsiveness");
      return res.data.data;
    },
    staleTime: 60_000,
  });
