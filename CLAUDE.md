# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Exam Duty (Proctavo) — a role-based exam-invigilation planner. CS (Controller of Superintendents) is the admin role; there is no separate "admin". DCS and RS supervise *groups* of rooms; Invigilators handle single rooms. The README.md is comprehensive and current — consult it for the full domain model, API reference, and role workflows. `APP_FLOW.md` walks each role's screens; `CREDENTIALS.md` lists local test logins; `NGROK_SETUP_GUIDE.md` covers exposing the app through a tunnel (needs the built frontend, not the dev server).

## Commands

```bash
npm run install:all          # from repo root: install backend + frontend deps (root `npm run dev` needs both)
npm run dev                  # from repo root: backend (nodemon, :5000) + frontend (vite, :5173) together
cd backend && npm run dev    # backend only
cd frontend && npm run dev   # frontend only
cd frontend && npm run build # tsc -b && vite build — this is the CI type-check gate
cd frontend && npm run lint  # eslint (non-blocking in CI)
```

There is no backend unit-test framework. Tests are **API integration tests** in `tests/` that hit a *running* backend over HTTP:

```bash
cd tests && npm test               # full suite (runner.js, ~90 tests) — requires backend up + seeded admin
cd tests && npm run test:duties    # one suite (scripts 01-auth … 10-create-exams mirror the filenames)
cd tests && node 07-duties.test.js # same thing — every suite self-runs via `require.main === module`
API_URL=https://host/api npm test  # target a remote backend
```

Prereqs for tests: MongoDB running, `node backend/scripts/seed-users.js` (creates `admin@examduty.com` / `Admin123`), backend started. CI (`.github/workflows/ci.yml`) runs both gates as blocking: frontend build/typecheck and the API suite against a throwaway Mongo.

Test-suite gotchas: credentials come from `tests/config.js` (`API_URL` env overrides the base URL only) and shared assertions from `tests/helpers.js`. The suites **write to whatever DB the running backend points at** — run them against a throwaway Mongo, not a dev DB you care about. `runner.js` runs 01→10 in order and threads the admin token from the auth suite onward; a single suite logs in for itself, but later suites lean on data earlier ones created, so a lone failure is worth re-checking under the full runner.

Backend env lives in `backend/.env` (`PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`; optional `CLIENT_ORIGINS` — comma-separated extra CORS origins; mail: `MAIL_ENABLED`, `MAIL_TRANSPORT` (**defaults to `console`, which renders without sending — leave it there locally and in CI**), `MAIL_USER`/`MAIL_PASS`/`MAIL_FROM`, `MAIL_HOST`/`MAIL_PORT` for plain SMTP, and `APP_URL` for email deep links; calendar: `CALENDAR_INVITES`, `APP_TIMEZONE`). Frontend needs no env locally — axios defaults to `/api` (overridable via `VITE_API_URL`) through the Vite proxy to :5000.

Password-reset OTP email is a *separate*, direct-send path (`backend/shared/utils/mailer.js`, not the outbox): `GMAIL_USER` + `GMAIL_APP_PASSWORD`, or `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` (+ `SMTP_SECURE`), with `EMAIL_FROM` overriding the sender. When none are set the transport is null and the OTP is logged to the server console instead, so the reset flow stays testable in dev.

Seed/maintenance scripts are in `backend/scripts/` (seed-users, seed-departments, seed-rooms, backfill-dcs-groups, dump-database/restore-database, etc.) — run with plain `node`.

Bootstrapping an empty DB, in this order (later scripts assume the earlier docs exist):

```bash
cd backend
node scripts/seed-users.js          # test logins for all four roles
node scripts/seed-departments.js    # departments × semesters + core courses
node scripts/seed-electives.js      # electives per (dept, semester)
node scripts/fix-elective-groups.js # bundle those electives under ElectiveGroup docs
node scripts/seed-rooms.js          # buildings + rooms
```

Faster alternative for a realistic dataset: `node scripts/restore-database.js ../db-dump.json --drop` (without `--drop` the existing `_id`s collide). `POST /users/bootstrap` is the unauthenticated escape hatch that creates the first CS when no users exist.

## Architecture

Two independent npm packages plus a test package: `backend/` (Express 4 + Mongoose), `frontend/` (Vite 6 + React 19 + TS 5 + Tailwind 4), `tests/`.

**Backend** — every domain is a module under `backend/modules/<domain>/` with `.routes.js → .controller.js → .service.js → .repository.js → .model.js`. Routes are mounted in `backend/app.js`. No cross-domain repository calls — services call other domains' services. Cross-cutting code lives in `backend/shared/` (DB config, `protect` auth middleware in `shared/middleware/auth.js`, `roleResolver`, `withOptionalTransaction`).

Three auth guards, not one: `protect` (valid token + `activeRole` re-validated against `roles`), `requireRole("cs", …)` (checks the token's **`activeRole`**, so a multi-role user must have selected that role to pass), and `allowUnselectedRole` — used *only* by `POST /auth/select-role`, the endpoint that promotes a `tempToken` into a role-bound token.

Error handling is centralized, so controllers never try/catch: wrap handlers in `catchAsync` and `throw new AppError(message, statusCode, details?)`. `shared/middleware/errorHandler.js` (mounted last in `app.js`) translates Mongoose failures — `ValidationError` → 400, duplicate key `11000` → 409 with a field-aware message, `CastError` → 400 — and every error response is `{ success: false, statusCode, message, details? }`. On the client, the axios response interceptor collapses that into `new Error(data.message)` and logs out on 401, so components only ever see `error.message` — never an axios error shape.

Less obvious backend modules: `notification` is the system-generated feed (emitter + scheduler); `notify` is a separate CS broadcast endpoint (`POST /api/notify`) — don't confuse the two; `mail` is service-only (no routes): the email side of `notification`, a transactional outbox plus a dispatcher. `seat-sharing` tracks rooms shared across overlapping exam schedules with atomic seat guards. `exam-cleanup` is service-only (no routes): cascading exam deletion — cancel duties, release seats, clean change requests, notify. `audit` is a CS-only who-did-what trail (fire-and-forget writes). `report` has one endpoint so far, `GET /api/reports/responsiveness` (CS) — the built-out **frontend** `modules/reports/` (duty roster, coverage charts, institution overview) is assembled from `duty-calculation` and exam endpoints, so don't read an empty backend `report` module as "reports aren't built".

**Frontend** — feature modules under `frontend/src/modules/<domain>/` each owning `components/`, `hooks/`, `services/`, `types.ts`. Role-specific route trees live in `modules/invigilator/`, `modules/rs/`, `modules/dcs/` (CS uses the top-level admin modules). Cross-role code goes in `modules/shared/`; imports flow one-way toward shared. App-wide primitives (AuthGuard, Modal, axios client, Zustand stores) are in `src/shared/`. Server state is React Query; client/auth state is Zustand (`shared/store/auth.store.ts` holds `token`/`tempToken`, `app.store.ts` holds UI state like `sidebarOpen`).

Frontend conventions worth knowing before adding UI: imports use the `@/` alias for `src/`, never deep relative paths. `App.tsx` lazy-imports every CS page and composes the role trees by spreading `invigilatorRoutes` / `rsRoutes` / `dcsRoutes` under one `ProtectedLayout` — a new page goes in its module's `routes/` file (or the lazy list) so it keeps its own chunk. Styling pulls tokens from the `@/shared/theme` barrel (`gradients`, `shadows`, `statusColors`/`examTypeColors`, `cardBase`/`innerPanel`, `chipVariants`/`buttonVariants`) rather than hand-rolled Tailwind, and both themes must work — dark mode is a supported surface, not an afterthought.

### Core invariants (violating these breaks real flows)

- **Roles are derived, not edited.** `User.roles` is an array computed from `designation` by `backend/shared/utils/roleResolver.js` — the single source of truth for eligibility everywhere (user CRUD, CS assignment pickers). Only designation `Other` allows picking a role manually.
- **Active role drives everything.** The JWT carries `activeRole`; multi-role users get a `tempToken` at login and pick a role via `POST /auth/select-role`. `protect` re-validates `activeRole` against `roles` on every request.
- **Password reset is a two-step OTP.** `POST /auth/forgot-password` (public) mails a 6-digit code; `POST /auth/reset-password` (public) verifies it and sets the new password. The OTP is stored on `User` as `resetOtpHash`/`resetOtpExpires`/`resetOtpAttempts` (all `select: false`, hashed, 10-min TTL, attempt-limited) — never returned by the API.
- **One duty record, two entry points.** A CS-assigned duty and a self-claimed duty are the identical `Duty` document — CS flows must reuse the same eligibility, conflict, grouping, and notification services, never duplicate them.
- **Building-aware conflicts.** `Duty` has both `room` (legacy string label) and `roomRef` (ObjectId → `Room`). Always query/compare by `roomRef` (frontend: `examRoom.room._id`) so room "004" in two buildings never collides.
- **Per-role slot independence.** One physical room hosts a DCS, an RS, and an invigilator simultaneously; conflict scans filter by role.
- **RS groups are derived, not persisted.** Partition key `${scheduleId}:${buildingId}:${chunkIndex}` (chunks of ≤5 rooms per building+slot, sorted numerically) must produce identical groups across Select Duty, Upcoming Duties, Change Requests, Dashboard, and CS assign panels — reuse `groupRoomsIntoRSGroups` (`frontend/src/modules/rs/select-duty/utils/rsDutyGroupingUtils.ts`), never re-derive ad hoc. DCS groups *are* persisted (`DCSGroup`, sized `ceil(students/300)` at exam finalize).
- **Group operations are transactional.** Group claims/assignments/swap-approvals create one duty per room atomically via `withOptionalTransaction`.
- **Notifications go through the emitter.** Any user-visible state change fires a typed notification via `backend/modules/notification/notification.emitter.js` — don't write `Notification` docs directly. That single choke point is also where **email** fans out, so a new type gets an inbox channel for free; opt out (or in) per type in `modules/mail/mail.policy.js`, never at the call site.
- **Email goes through the outbox, never straight to SMTP.** `emit` writes an `EmailOutbox` row in the *same transaction* as the notification and `mail.dispatcher.js` sends it afterwards. Both halves matter: `emit` is routinely called inside `withOptionalTransaction` (group claims, swap approvals), so a direct send would email a teacher about a duty a rollback then erased — and it would put SMTP latency and outages on the duty-assignment request path. Mail failures are swallowed by design; a queued email must never turn a successful assignment into a 500.
- **Calendars are reconciled, not event-driven.** `modules/calendar/` emails standard iCalendar invites (REQUEST / CANCEL, organizer = `MAIL_FROM`, `RSVP=FALSE`) through the same outbox. `calendar.sync.syncTeacher` diffs a teacher's live upcoming duty units (one per teacher + schedule + role — an RS/DCS group is ONE event) against `CalendarEvent` (last sent: uid, sequence, fingerprint) and queues only the difference; unchanged → nothing, past events are never cancelled. Triggered ~5s after any duty-related notification (`CALENDAR_TRIGGERS` in the emitter) and by the 6-hourly sweep, which also backfills on first deploy and catches changes that notify nobody. Don't attach invites at call sites. Env: `CALENDAR_INVITES` (unset = automatic sync only with a real `MAIL_TRANSPORT` — under `console` it would record invites as delivered and a later switch to real mail would never backfill; `true` forces, `false` disables), `APP_TIMEZONE` (default `Asia/Kolkata`; duty times are local wall-clock). Verify with `MAIL_TRANSPORT=console node scripts/verify-calendar.js` against a throwaway DB. Note nodemon restarts re-run the sweep — with a real `MAIL_TRANSPORT`, dev edits send real invites.
- **Duties are confirmed, reminded and nudged per unit.** `duty/duty.unit.js` defines the unit (teacher + schedule + role — an RS/DCS group is one) that confirmations, reminders and calendar invites all share; reuse it. `Duty.confirmedAt/confirmedVia`: CS-assigned starts null; self-claims (model pre-validate hook) and change requests the teacher raised are confirmed at creation; a swap resets it for the new holder. Teachers confirm via `POST /duties/:id/confirm` or the signed one-click `GET /duties/confirm/:token` (public, HMAC with `JWT_SECRET`, renders HTML) — both confirm the whole unit. The mail dispatcher adds the "Confirm I'll be there" button at send time from `data.refDutyId` (the emitter sets it for `refModel: "Duty"`). `notification/reminder.jobs.js`: 3d / 1d / 30m reminders (a stage is skipped once stale or if the duty was assigned after it), a confirm nudge 24h after assignment, a CS alert the day before if still unconfirmed, and select-your-duty nudges for below-target teachers when an exam with open slots starts within 7/3 days — all `emitIfAbsent`-deduped. The scheduler runs a 5-minute tick for these plus the 6-hourly sweeps. Unconfirmed duties are only ever flagged, never auto-released. CS view: `GET /api/reports/responsiveness` → Reports → Responsiveness. `User.lastActiveAt` is stamped by `protect` at most every 10 min. Verify with `scripts/verify-reminders.js`.
- **Self-claim notifies too.** A teacher selecting a duty emits `duty_self_claimed` to them plus `duty_claimed_by_teacher` to CS (this path notified nobody before). `cancelDuty` takes an `actor` argument for exactly one reason: to distinguish a teacher releasing their own duty (which alerts CS) from a CS cancellation (which doesn't). Time-based notifications (`duty_reminder`, `target_reached`) come from an in-process scheduler (`notification.scheduler.js`) that runs idempotent sweeps (`notification.jobs.js`) every 6 hours using `emitIfAbsent` with dedupe keys — safe across nodemon restarts.
- **Upcoming vs. completed is one function.** `isDutyUpcoming` in `frontend/src/modules/shared/duties/utils/dutyTiming.ts` (date in future, or today with end time not yet passed) is the single source of truth for the upcoming/completed split across all dashboards and Upcoming Duties pages — don't compare dates ad hoc.
- **Soft deletes with pre-hooks.** `User`, `Exam`, and `ExamGroup` soft-delete; Mongoose pre-find hooks hide them automatically (bypass via `includeInactive` / the activate path).
- **Duty targets are computed on demand** (`duty-calculation` module) — never cache them; distribution order is stable by `_id` so recomputes agree.
- **CS unassign reuses the cancel paths.** Single invigilator duty → `PATCH /duties/:id/cancel` (CS may cancel any duty; anyone else only their own — 403). RS/DCS → `POST /duties/admin-unassign-group { dutyId }`, which expands to every live duty that teacher holds on that schedule (RS) or releases the persisted `DCSGroup` back to `open` (DCS) — never room by room; a CS single-cancel of an RS/DCS duty is a 400. The teacher gets `duty_cancelled` / `duty_group_cancelled` (with CS's optional reason); CS gets no release alert about itself. All `admin-*` duty routes are `requireRole("cs")`. UI: `UnassignDutyModal` (manage-duties), used by Teacher Details and the exam room `DutyStatusModal`.
- **Group roles count as one duty per group.** RS/DCS persist one `Duty` per room, but everywhere they're *counted or listed* they collapse to a single unit per group — RS by `${scheduleId}:${buildingId}:${chunk}` (chunks of 5), DCS by schedule/`DCSGroup`. Reuse `countDutyUnits` (`frontend/src/modules/manage-duties/utils/dutyUnitCounts.ts`) on the client and the group counters in `dutyCalculation.service.js` on the backend; never tally RS/DCS per-room.
- **Target-reached blocks CS assignment.** Per-teacher progress carries `assigned` (active = upcoming+ongoing+completed, in the role's unit) and `reached` (`assigned >= target`) — distinct from `completed` (past-only, which drives the progress circles). `assertTargetNotReached(teacherId, role)` guards the three CS admin-assign paths (`adminAssignDuty`, `adminAssignDutyGroup`, `dcsGroup.adminClaimGroup`); self-claim is intentionally exempt. Per-teacher role progress: `GET /duty-calculation/teacher/:id/{progress|rs-progress|dcs-progress}`.
- **Only CS sees who holds a duty.** In the teacher-facing room modal, `RoleAssignmentCard` (`frontend/src/modules/shared/components/`) reveals an assignee's name/contact only for the viewer's own duty (`OWNED`) or when `revealAssignees` is set (viewer is co-assigned in that room); other occupied slots read "Occupied" with no identity. CS uses a different component (`DutyOverviewContent`) and sees everyone. Enforced client-side only — the duty-status API still returns identities to all roles.
- **Exam listings group Status → Type.** The shared `ExamGroupSection` + `useGroupedExams` render Ongoing → Upcoming → Completed, then SEE → IA1 → IA2 → IA3 within each status. Used by the CS Exams page, the invigilator/RS exam lists, and the CS assign-duty exam picker — change grouping/order there once, never per page.

## Deployment

Production runs at **proctavo.com** behind nginx with a same-origin `/api` — CORS config in `app.js` allowlists proctavo.com origins. `db-dump.json` at the repo root is an Extended-JSON database snapshot managed by `dump-database.js` / `restore-database.js`.
