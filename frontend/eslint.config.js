import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Module-boundary enforcement.
 *
 * The frontend is organised as feature modules under `src/modules/<name>`.
 * A feature module may import:
 *   - itself (relative imports)
 *   - the shared layers: `@/shared/*` (design system, stores, api client)
 *     and `@/modules/shared/*` (shared domain logic)
 *   - `@/modules/duties/*` — the core duty domain (types, conflict services)
 *     consumed by nearly every feature; treated as a shared domain library
 *   - `@/modules/exams/types` — the exam domain types, same status
 *
 * Anything else (feature → feature) is a boundary violation. The remaining
 * cross-module dependencies are grandfathered per module below — shrink these
 * lists over time, never grow them.
 */

// Modules every feature may use freely.
const SHARED = ["shared", "duties"];

// `@/modules/exams/types` acts as a shared domain contract despite living in
// a feature module (candidate to physically move into modules/shared/exams
// later), so the exams pattern is a regex that carves out that subpath.
const EXAMS_REGEX = "^@/modules/exams(?:$|/(?!types(?:$|/)))";

// Grandfathered feature → feature dependencies (documented tech debt).
// rs/dcs mount the multi-role exams browser that lives in invigilator/exams;
// invigilator/exams orchestrates DCS/RS group lookups for that browser;
// the CS assign panels (exams) reuse the RS grouping algorithm and DCS duty
// service; role dashboards embed duty-calculation stats heroes and the
// dashboard module's important-notification provider.
const LEGACY_ALLOW = {
  rs: ["invigilator", "duty-calculation", "dashboard"],
  dcs: ["invigilator", "duty-calculation", "dashboard"],
  invigilator: ["dcs", "rs", "exams", "notifications", "duty-calculation", "dashboard"],
  exams: ["rs", "dcs", "manage-duties", "create-exams", "duty-calculation", "users", "infrastructure"],
  "manage-duties": ["rs", "dcs", "exams", "duty-calculation", "users"],
  "change-requests": ["exams", "users"],
  dashboard: ["exams", "duty-calculation", "notifications", "change-requests", "dcs", "rs", "invigilator"],
  "create-exams": ["exams", "departments", "infrastructure", "users"],
  duties: ["exams", "users", "dcs"],
  "duty-calculation": ["exams", "users"],
  reports: ["exams", "users", "departments", "duty-calculation"],
  notify: ["users", "departments"],
  departments: ["users"],
  audit: ["users"],
};

const FEATURE_MODULES = [
  "audit",
  "auth",
  "change-requests",
  "create-exams",
  "dashboard",
  "dcs",
  "departments",
  "duties",
  "duty-calculation",
  "exams",
  "infrastructure",
  "invigilator",
  "manage-duties",
  "notifications",
  "notify",
  "reports",
  "rs",
  "users",
];

function restrictedPatterns(forbidden, message) {
  return [
    "error",
    {
      patterns: forbidden.map((m) =>
        m === "exams"
          ? { regex: EXAMS_REGEX, message: message(m) }
          : {
              group: [`@/modules/${m}/*`, `@/modules/${m}`],
              message: message(m),
            },
      ),
    },
  ];
}

function boundaryOverride(mod) {
  const allowed = new Set([mod, ...SHARED, ...(LEGACY_ALLOW[mod] ?? [])]);
  const forbidden = FEATURE_MODULES.filter((m) => !allowed.has(m));
  if (forbidden.length === 0) return null;
  return {
    files: [`src/modules/${mod}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": restrictedPatterns(
        forbidden,
        (m) =>
          `Feature module "${mod}" must not import from "${m}". Move the shared piece into modules/shared (or src/shared) instead.`,
      ),
    },
  };
}

const SHARED_LAYER_FORBIDDEN = FEATURE_MODULES.filter((m) => m !== "duties");

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // The shared layers must stay role- and feature-agnostic: they may not
  // import from any feature module (duties excepted — shared domain lib).
  {
    files: ["src/shared/**/*.{ts,tsx}", "src/modules/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedPatterns(
        SHARED_LAYER_FORBIDDEN,
        (m) =>
          `The shared layer must stay feature-agnostic — invert the dependency so "${m}" adapts to a contract defined in shared.`,
      ),
    },
  },
  // App shell: Navbar/AuthGuard/ProtectedLayout compose feature UI (auth
  // role modal, notifications bell) by design — they are the application
  // layer, not the design system.
  {
    files: ["src/shared/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedPatterns(
        SHARED_LAYER_FORBIDDEN.filter((m) => m !== "auth" && m !== "notifications"),
        (m) =>
          `The app shell may only compose auth/notifications — "${m}" must adapt to a shared contract instead.`,
      ),
    },
  },
  // TODO(boundaries): the DutyGroup* components still fetch via DCS/RS
  // services and know both group shapes. Invert by passing data/adapters in
  // from role modules, then delete this override.
  {
    files: ["src/modules/shared/components/DutyGroup*.tsx"],
    rules: {
      "no-restricted-imports": restrictedPatterns(
        SHARED_LAYER_FORBIDDEN.filter((m) => m !== "dcs" && m !== "rs"),
        (m) =>
          `The shared layer must stay feature-agnostic — invert the dependency so "${m}" adapts to a contract defined in shared.`,
      ),
    },
  },
  ...FEATURE_MODULES.map(boundaryOverride).filter(Boolean),
);
