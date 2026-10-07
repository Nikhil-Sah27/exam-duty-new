import { UserRole } from "@/shared/lib/types";

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: UserRole[];
  department: string | null;
  designation: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  designation: string;
  // The user picks a single role when designation === "Other". For
  // rule-driven designations, roles is inferred server-side and this
  // field can be omitted.
  roles?: UserRole[];
  department?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  roles?: UserRole[];
}

export interface UserListResponse {
  success: boolean;
  count: number;
  data: UserProfile[];
}

export interface UserResponse {
  success: boolean;
  data: UserProfile;
}

// ── CSV import (POST /users/import, CS only) ──────────────────────────────

/** One teacher parsed from the CSV. `line` is the spreadsheet row (header = 1). */
export interface ImportUserRow {
  line: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  role: string;
  password: string;
}

export interface ImportUsersRequest {
  rows: ImportUserRow[];
  defaultPassword?: string;
  dryRun?: boolean;
}

export type ImportRowStatus = "create" | "created" | "exists" | "error";

export interface ImportRowResult {
  line: number;
  name: string;
  email: string;
  status: ImportRowStatus;
  message?: string;
  designation?: string;
  department?: string | null;
  roles?: UserRole[];
}

export interface ImportUsersResult {
  dryRun: boolean;
  summary: { total: number; ready: number; created: number; skipped: number; errors: number };
  results: ImportRowResult[];
}

