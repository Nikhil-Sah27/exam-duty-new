# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Exam Duty (Proctavo) — a role-based exam-invigilation planner. CS (Controller of Superintendents) is the admin role; there is no separate "admin". DCS and RS supervise *groups* of rooms; Invigilators handle single rooms. The README.md is comprehensive and current — consult it for the full domain model, API reference, and role workflows. `APP_FLOW.md` walks each role's screens; `CREDENTIALS.md` lists local test logins.

## Commands

```bash
npm run dev                  # from repo root: backend (nodemon, :5000) + frontend (vite, :5173) together
cd backend && npm run dev    # backend only
cd frontend && npm run dev   # frontend only
cd frontend && npm run build # tsc -b && vite build — this is the CI type-check gate
cd frontend && npm run lint  # eslint (non-blocking in CI)
```

There is no backend unit-test framework. Tests are **API integration tests** in `tests/` that hit a *running* backend over HTTP:

```bash
cd tests && npm test               # full suite (runner.js, ~90 tests) — requires backend up + seeded admin
node 07-duties.test.js             # run a single suite
API_URL=https://host/api npm test  # target a remote backend
```

Prereqs for tests: MongoDB running, `node backend/scripts/seed-users.js` (creates `admin@examduty.com` / `Admin123`), backend started. CI (`.github/workflows/ci.yml`) runs both gates as blocking: frontend build/typecheck and the API suite against a throwaway Mongo.

Backend env lives in `backend/.env` (`PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`; optional `CLIENT_ORIGINS` — comma-separated extra CORS origins). Frontend needs no env locally — axios defaults to `/api` (overridable via `VITE_API_URL`) through the Vite proxy to :5000.

Seed/maintenance scripts are in `backend/scripts/` (seed-users, seed-departments, seed-rooms, backfill-dcs-groups, dump-database/restore-database, etc.) — run with plain `node`.

## Architecture

Two independent npm packages plus a test package: `backend/` (Express 4 + Mongoose), `frontend/` (Vite 6 + React 19 + TS 5 + Tailwind 4), `tests/`.

**Backend** — every domain is a module under `backend/modules/<domain>/` with `.routes.js → .controller.js → .service.js → .repository.js → .model.js`. Routes are mounted in `backend/app.js`. No cross-domain repository calls — services call other domains' services. Cross-cutting code lives in `backend/shared/` (DB config, `protect` auth middleware in `shared/middleware/auth.js`, `roleResolver`, `withOptionalTransaction`).

Less obvious backend modules: `notification` is the system-generated feed (emitter + scheduler); `notify` is a separate CS broadcast endpoint (`POST /api/notify`) — don't confuse the two. `seat-sharing` tracks rooms shared across overlapping exam schedules with atomic seat guards. `exam-cleanup` is service-only (no routes): cascading exam deletion — cancel duties, release seats, clean change requests, notify. `audit` is a CS-only who-did-what trail (fire-and-forget writes). `report` is a mounted placeholder with no endpoints yet.

**Frontend** — feature modules under `frontend/src/modules/<domain>/` each owning `components/`, `hooks/`, `services/`, `types.ts`. Role-specific route trees live in `modules/invigilator/`, `modules/rs/`, `modules/dcs/` (CS uses the top-level admin modules). Cross-role code goes in `modules/shared/`; imports flow one-way toward shared. App-wide primitives (AuthGuard, Modal, axios client, Zustand stores) are in `src/shared/`. Server state is React Query; client/auth state is Zustand.

### Core invariants (violating these breaks real flows)

- **Roles are derived, not edited.** `User.roles` is an array computed from `designation` by `backend/shared/utils/roleResolver.js` — the single source of truth for eligibility everywhere (user CRUD, CS assignment pickers). Only designation `Other` allows picking a role manually.
- **Active role drives everything.** The JWT carries `activeRole`; multi-role users get a `tempToken` at login and pick a role via `POST /auth/select-role`. `protect` re-validates `activeRole` against `roles` on every request.
- **One duty record, two entry points.** A CS-assigned duty and a self-claimed duty are the identical `Duty` document — CS flows must reuse the same eligibility, conflict, grouping, and notification services, never duplicate them.
- **Building-aware conflicts.** `Duty` has both `room` (legacy string label) and `roomRef` (ObjectId → `Room`). Always query/compare by `roomRef` (frontend: `examRoom.room._id`) so room "004" in two buildings never collides.
- **Per-role slot independence.** One physical room hosts a DCS, an RS, and an invigilator simultaneously; conflict scans filter by role.
- **RS groups are derived, not persisted.** Partition key `${scheduleId}:${buildingId}:${chunkIndex}` (chunks of ≤5 rooms per building+slot, sorted numerically) must produce identical groups across Select Duty, Upcoming Duties, Change Requests, Dashboard, and CS assign panels — reuse `groupRoomsIntoRSGroups` (`frontend/src/modules/rs/select-duty/utils/rsDutyGroupingUtils.ts`), never re-derive ad hoc. DCS groups *are* persisted (`DCSGroup`, sized `ceil(students/300)` at exam finalize).
- **Group operations are transactional.** Group claims/assignments/swap-approvals create one duty per room atomically via `withOptionalTransaction`.
- **Notifications go through the emitter.** Any user-visible state change fires a typed notification via `backend/modules/notification/notification.emitter.js` — don't write `Notification` docs directly. Time-based notifications (`duty_reminder`, `target_reached`) come from an in-process scheduler (`notification.scheduler.js`) that runs idempotent sweeps (`notification.jobs.js`) every 6 hours using `emitIfAbsent` with dedupe keys — safe across nodemon restarts.
- **Upcoming vs. completed is one function.** `isDutyUpcoming` in `frontend/src/modules/shared/duties/utils/dutyTiming.ts` (date in future, or today with end time not yet passed) is the single source of truth for the upcoming/completed split across all dashboards and Upcoming Duties pages — don't compare dates ad hoc.
- **Soft deletes with pre-hooks.** `User`, `Exam`, and `ExamGroup` soft-delete; Mongoose pre-find hooks hide them automatically (bypass via `includeInactive` / the activate path).
- **Duty targets are computed on demand** (`duty-calculation` module) — never cache them; distribution order is stable by `_id` so recomputes agree.

## Deployment

Production runs at **proctavo.com** behind nginx with a same-origin `/api` — CORS config in `app.js` allowlists proctavo.com origins. `db-dump.json` at the repo root is an Extended-JSON database snapshot managed by `dump-database.js` / `restore-database.js`.
