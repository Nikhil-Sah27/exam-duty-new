import api from "@/shared/lib/api";
import {
  CreateUserRequest,
  ImportUsersRequest,
  ImportUsersResult,
  UpdateUserRequest,
  UserListResponse,
  UserResponse,
  UserProfile,
} from "../types";

export interface FetchUsersOptions {
  // When true, the response includes deactivated users too (Teachers admin page).
  includeInactive?: boolean;
}

export const fetchUsers = async (
  options: FetchUsersOptions = {}
): Promise<UserProfile[]> => {
  const res = await api.get<UserListResponse>("/users", {
    params: options.includeInactive ? { includeInactive: true } : undefined,
  });
  return res.data.data;
};

export const fetchUserById = async (id: string): Promise<UserProfile> => {
  const res = await api.get<UserResponse>(`/users/${id}`);
  return res.data.data;
};

export const createUser = async (data: CreateUserRequest): Promise<UserProfile> => {
  const res = await api.post<UserResponse>("/users", data);
  return res.data.data;
};

export const updateUser = async (
  id: string,
  data: UpdateUserRequest
): Promise<UserProfile> => {
  const res = await api.put<UserResponse>(`/users/${id}`, data);
  return res.data.data;
};

export const deleteUser = async (id: string): Promise<void> => {
  await api.delete(`/users/${id}`);
};

export const activateUser = async (id: string): Promise<UserProfile> => {
  const res = await api.patch<UserResponse>(`/users/${id}/activate`);
  return res.data.data;
};

/** CS bulk import from a parsed CSV; `dryRun` validates without creating anyone. */
export const importUsers = async (data: ImportUsersRequest): Promise<ImportUsersResult> => {
  const res = await api.post<{ success: boolean; data: ImportUsersResult }>("/users/import", data);
  return res.data.data;
};
