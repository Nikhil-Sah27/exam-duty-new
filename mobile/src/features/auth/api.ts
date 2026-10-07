import api from "@/lib/api";
import type { ApiEnvelope, LoginResult, User, UserRole } from "@/lib/types";

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await api.post<ApiEnvelope<LoginResult>>("/auth/login", { email: email.trim().toLowerCase(), password });
  return res.data.data;
}

/** Works with a tempToken (first pick) or a full token (switching role). */
export async function selectRole(role: UserRole): Promise<{ user: User; token: string }> {
  const res = await api.post<ApiEnvelope<{ user: User; token: string }>>("/auth/select-role", { role });
  return res.data.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get<ApiEnvelope<User>>("/auth/me");
  return res.data.data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
  await api.post("/auth/reset-password", { email: email.trim().toLowerCase(), otp: otp.trim(), newPassword });
}
