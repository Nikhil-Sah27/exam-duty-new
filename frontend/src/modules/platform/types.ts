import type { CollegeFeatures, CollegeSummary } from "@/shared/lib/types";

/** A college as the superadmin's console lists it (counts, never people). */
export interface PlatformCollege extends CollegeSummary {
  createdAt: string;
  counts: { teachers: number; exams: number; upcomingDuties: number };
}

export interface CsAccount {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface PlatformCollegeDetail extends PlatformCollege {
  csAccounts: CsAccount[];
}

export interface NewCsAccount {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface CreateCollegeRequest {
  name: string;
  code: string;
  features: CollegeFeatures;
  cs: NewCsAccount;
}

export interface UpdateCollegeRequest {
  name?: string;
  code?: string;
  status?: "active" | "suspended";
  features?: Partial<CollegeFeatures>;
}

interface FeatureInfo {
  key: keyof CollegeFeatures;
  label: string;
  description: string;
}

/** The exam-type switches — mirrors backend shared/tenancy/features.js. */
export const FEATURE_LIST: FeatureInfo[] = [
  { key: "cie", label: "CIE exams", description: "Internal assessments — IA1, IA2, IA3" },
  { key: "see", label: "SEE exams", description: "Semester end examinations" },
];

/** The per-college ads switch (ADS_PLAN.md). Hides nothing, so it gets no confirm step. */
export const ADS_FEATURE: FeatureInfo = {
  key: "ads",
  label: "Ads in the app",
  description: "Banner ads for this college's teachers — more for those behind on their duties",
};

/** The platform-wide ads master switch. */
export interface PlatformAdSettings {
  adsEnabled: boolean;
  updatedAt: string | null;
}
