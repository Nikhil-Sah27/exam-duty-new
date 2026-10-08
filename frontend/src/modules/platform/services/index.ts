import api from "@/shared/lib/api";
import type {
  CreateCollegeRequest,
  NewCsAccount,
  PlatformCollege,
  PlatformCollegeDetail,
  UpdateCollegeRequest,
} from "../types";

type Envelope<T> = { success: boolean; data: T };

export const fetchColleges = async (): Promise<PlatformCollege[]> =>
  (await api.get<Envelope<PlatformCollege[]>>("/platform/colleges")).data.data;

export const fetchCollege = async (id: string): Promise<PlatformCollegeDetail> =>
  (await api.get<Envelope<PlatformCollegeDetail>>(`/platform/colleges/${id}`)).data.data;

export const createCollege = async (data: CreateCollegeRequest): Promise<PlatformCollegeDetail> =>
  (await api.post<Envelope<PlatformCollegeDetail>>("/platform/colleges", data)).data.data;

export const updateCollege = async (id: string, data: UpdateCollegeRequest): Promise<PlatformCollegeDetail> =>
  (await api.patch<Envelope<PlatformCollegeDetail>>(`/platform/colleges/${id}`, data)).data.data;

export const addCsAccount = async (id: string, data: NewCsAccount): Promise<PlatformCollegeDetail> =>
  (await api.post<Envelope<PlatformCollegeDetail>>(`/platform/colleges/${id}/cs`, data)).data.data;

export const setCsActive = async (id: string, userId: string, active: boolean): Promise<PlatformCollegeDetail> =>
  (await api.patch<Envelope<PlatformCollegeDetail>>(`/platform/colleges/${id}/cs/${userId}`, { active })).data.data;

export const resetCsPassword = async (id: string, userId: string, password: string): Promise<void> => {
  await api.post(`/platform/colleges/${id}/cs/${userId}/reset-password`, { password });
};
