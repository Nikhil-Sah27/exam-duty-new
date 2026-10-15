import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addCsAccount,
  createCollege,
  fetchCollege,
  fetchColleges,
  resetCsPassword,
  setCsActive,
  updateCollege,
} from "../services";
import type { CreateCollegeRequest, NewCsAccount, PlatformCollegeDetail, UpdateCollegeRequest } from "../types";

const KEY = ["platform", "colleges"] as const;

export const useColleges = () => useQuery({ queryKey: KEY, queryFn: fetchColleges });

export const useCollege = (id: string | undefined) =>
  useQuery({ queryKey: [...KEY, id], queryFn: () => fetchCollege(id as string), enabled: !!id });

/** Every write returns the fresh college detail: seed its cache, refresh the list. */
const useCollegeWrite = <V,>(fn: (vars: V) => Promise<PlatformCollegeDetail>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (college) => {
      qc.setQueryData([...KEY, college.id], college);
      qc.invalidateQueries({ queryKey: KEY, exact: true });
    },
  });
};

export const useCreateCollege = () => useCollegeWrite((data: CreateCollegeRequest) => createCollege(data));

export const useUpdateCollege = (id: string) =>
  useCollegeWrite((data: UpdateCollegeRequest) => updateCollege(id, data));

export const useAddCsAccount = (id: string) => useCollegeWrite((data: NewCsAccount) => addCsAccount(id, data));

export const useSetCsActive = (id: string) =>
  useCollegeWrite(({ userId, active }: { userId: string; active: boolean }) => setCsActive(id, userId, active));

export const useResetCsPassword = (id: string) =>
  useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) => resetCsPassword(id, userId, password),
  });
