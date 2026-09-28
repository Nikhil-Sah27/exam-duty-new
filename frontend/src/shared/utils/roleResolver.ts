// Frontend mirror of backend/shared/utils/roleResolver.js.
// Keep in sync — the backend is the enforcement point; this file drives
// the create/edit user UI so the user sees the rule before submitting.

import type { UserRole } from "@/shared/lib/types";

export const OTHER_DESIGNATION = "Other";

export const SELECTABLE_ROLES_FOR_OTHER: UserRole[] = [
  "cs",
  "dcs",
  "rs",
  "invigilator",
];

const DESIGNATION_ROLE_MAP: Record<string, UserRole[]> = {
  "HOD/Dean": ["dcs"],
  Professor: ["rs"],
  "Associate Professor": ["rs", "invigilator"],
  "Assistant Professor": ["invigilator"],
};

/**
 * Returns:
 *   • an array of roles FIXED by the designation (locked in the UI)
 *   • null when designation === "Other" (user picks manually)
 *   • null when designation is unknown/empty (treat as manual pick / no-op)
 */
export function resolveRolesFromDesignation(
  designation: string | null | undefined
): UserRole[] | null {
  if (!designation || designation === OTHER_DESIGNATION) return null;
  return DESIGNATION_ROLE_MAP[designation] || null;
}

/**
 * Convenience for UI: whether the Role selector should be editable.
 * Editable only when designation is "Other".
 */
export function isRoleSelectionLocked(
  designation: string | null | undefined
): boolean {
  return !!designation && designation !== OTHER_DESIGNATION;
}
