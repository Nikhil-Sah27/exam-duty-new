// "superadmin" runs the platform (colleges, their CS and feature switches) and
// belongs to no college; the other four are roles inside one college.
export type UserRole = "superadmin" | "cs" | "dcs" | "rs" | "invigilator";

/** Roles that hold duty slots (CS assigns them; the superadmin has none). */
export type DutyRole = "dcs" | "rs" | "invigilator";

/** Per-college feature switches, set by the superadmin (MULTI_COLLEGE_PLAN.md). */
export interface CollegeFeatures {
  cie: boolean;
  see: boolean;
}

export interface CollegeSummary {
  id: string;
  name: string;
  code: string;
  status: "active" | "suspended";
  features: CollegeFeatures;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  roles: UserRole[];
  activeRole: UserRole | null;
  /** The college this account works in; null for the superadmin. */
  college?: CollegeSummary | null;
}
