import { useAuthStore } from "@/shared/store/auth.store";
import type { CollegeFeatures } from "@/shared/lib/types";

const ALL_ON: CollegeFeatures = { cie: true, see: true };

/**
 * The signed-in college's feature switches. Defaults to everything on until
 * /auth/me has loaded — the server enforces the real switches either way.
 */
export const useCollegeFeatures = (): CollegeFeatures =>
  useAuthStore((s) => s.user?.college?.features) ?? ALL_ON;
