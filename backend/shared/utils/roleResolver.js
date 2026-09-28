// Designation → allowed roles map. Single source of truth on the backend.
// Keep in sync with frontend/src/shared/utils/roleResolver.ts.

const DESIGNATION_ROLE_MAP = {
  "HOD/Dean": ["dcs"],
  "Professor": ["rs"],
  "Associate Professor": ["rs", "invigilator"],
  "Assistant Professor": ["invigilator"],
};

const OTHER_DESIGNATION = "Other";
const SELECTABLE_ROLES_FOR_OTHER = ["cs", "dcs", "rs", "invigilator"];

// Returns:
//   • an array of roles fixed by the designation (caller cannot override)
//   • null when the designation is "Other" (caller picks a single role from SELECTABLE_ROLES_FOR_OTHER)
const resolveRolesFromDesignation = (designation) => {
  if (designation === OTHER_DESIGNATION) return null;
  return DESIGNATION_ROLE_MAP[designation] || null;
};

// Enforce the rules on create/update. Returns the roles array to persist.
// Throws if the requested roles violate the designation rule.
const enforceRolesForDesignation = (designation, requestedRoles) => {
  const fixed = resolveRolesFromDesignation(designation);
  if (fixed) return fixed;

  // Designation is "Other" (or missing) — caller must supply exactly one role from the allowed set.
  if (!Array.isArray(requestedRoles) || requestedRoles.length !== 1) {
    const err = new Error(
      'When designation is "Other", exactly one role must be provided'
    );
    err.statusCode = 400;
    throw err;
  }
  const [role] = requestedRoles;
  if (!SELECTABLE_ROLES_FOR_OTHER.includes(role)) {
    const err = new Error(`Role "${role}" is not selectable`);
    err.statusCode = 400;
    throw err;
  }
  return [role];
};

module.exports = {
  DESIGNATION_ROLE_MAP,
  OTHER_DESIGNATION,
  SELECTABLE_ROLES_FOR_OTHER,
  resolveRolesFromDesignation,
  enforceRolesForDesignation,
};
