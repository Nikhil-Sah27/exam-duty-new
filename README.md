# Exam Duty

A role-based web application for planning exams and distributing invigilation duties across an academic institution. Administrators plan exam schedules and allocate rooms; supervision staff (CS, DCS, RS) manage groups of rooms; invigilators claim or swap individual duties. Every action flows through building-aware conflict detection, per-role slot independence, a duty-target calculation engine, and an approval workflow for changes.

## Roles

Roles are stored as an **array** on the `User` document (`backend/modules/auth/auth.model.js`) — one account can hold several duty roles. The role set is derived from the user's **designation** (see [Designation → Role Rules](#designation--role-rules)), and each login resolves to a single **active role** that drives both backend authorization and the frontend route tree.

| Role | Full Name | Grain | Responsibilities |
| --- | --- | --- | --- |
| **CS** | Controller of Superintendents | System | Full admin — creates exams, departments, rooms, users; reviews change requests; assigns duties directly; broadcasts announcements. |
| **DCS** | Deputy Controller of Superintendents | Room *group* (student-count sized, one DCS per ≤300 students) | Claims a supervision group; oversees every room in the group; can approve change requests. |
| **RS** | Room Superintendent | Room *group* (chunks of ≤5 rooms per building + time slot) | Claims a room group; supervises up to 5 rooms in the same block during a shift. |
| **Invigilator** | Faculty Invigilator | Single room | Self-assigns or is assigned a single room per time slot; submits change requests. |

Group vs. individual is the key mental model: **DCS and RS work on whole groups**; **Invigilators work on individual rooms**. Every screen a group role sees — Select Duty, Upcoming Duties, Change Requests, Dashboard — is grouped, never per-room.

### Multi-Role Accounts & Active Role

A user can hold more than one role (e.g. an Associate Professor is both **RS** and **Invigilator**). Authentication reflects this:

- **Single-role user** — login returns a full JWT (`token`) whose payload carries `activeRole`; they land directly on that role's dashboard.
- **Multi-role user** — login returns a `tempToken` (payload `activeRole: null`) and `requiresRoleSelection: true`. The frontend routes them to the **Role Selection** page (`frontend/src/modules/auth/components/RoleSelectionPage.tsx`), where they pick an active role via `POST /auth/select-role`, which mints the full token.
- **Switching roles** — the profile menu exposes a `RoleSelectionModal` so a multi-role user can switch their active role without logging out.

The `protect` middleware requires a resolved `activeRole` and re-validates it against the user's current `roles` array on every request; the `allowUnselectedRole` middleware is the one exception, used only by `POST /auth/select-role`.

### Designation → Role Rules

Role eligibility is centralized in `backend/shared/utils/roleResolver.js` — a single source of truth reused everywhere (user create/update, and the CS direct-assignment eligible-teacher lists). Roles are derived from designation and cannot be hand-edited unless the designation is `Other`:

| Designation | Roles assigned |
| --- | --- |
| **HOD/Dean** | `dcs` |
| **Professor** | `rs` |
| **Associate Professor** | `rs`, `invigilator` |
| **Assistant Professor** | `invigilator` |
| **Other** | Caller picks exactly one of `cs` / `dcs` / `rs` / `invigilator` |

Assistant Professors are **Invigilator-only** — RS duty is carried by Professors and Associate Professors. (The frontend mirror lives at `frontend/src/shared/utils/roleResolver.ts`; keep the two in sync. A one-time migration, `backend/scripts/strip-rs-from-assistant-professors.js`, removed `rs` from existing Assistant Professors while preserving `invigilator`.)

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vite 6 · React 19 · TypeScript 5 · Tailwind CSS 4 · React Router 7 |
| State | Zustand (client/auth state) · TanStack React Query (server cache) |
| Backend | Node.js · Express 4 |
| Database | MongoDB (Mongoose ODM) |
| Auth | JWT (bcrypt-hashed passwords) · active-role selection |
| Dev | nodemon (backend hot-reload) · Vite HMR (frontend) |

## Feature Overview

### Exam Planning (CS)
- **Create Exams** wizard for both CIE (IA1/IA2/IA3) and SEE (Semester End). Handles department selection, date auto-calculation from shifts, room allocation, seat-sharing configuration, and DCS group formation in a single transactional finalize call.
- **Exams** — list, filter, edit; timetable per exam with per-room duty status. The timetable groups rooms by date and time slot, with highlighted date and time-slot headers and a highlighted **Department** filter for quickly narrowing multi-department schedules.
- **Departments** — CRUD for departments, semesters, courses (core or elective), and elective groups (a named group of subjects — no professional/open sub-type, no per-elective student count).
- **Infrastructure** — buildings and rooms with capacity, floor, and bulk-import support.
- **Users** — teacher profiles with designation-driven roles and department; reactivate soft-deleted teachers; one-time admin bootstrap endpoint.

### Duty Assignment
- **Self-assign** — Invigilators claim single rooms; RS and DCS claim groups (one API call creates a duty per room in the group, transactionally).
- **CS admin-assign (direct)** — CS can force any eligible teacher into any slot without going through the teacher's Select Duty flow:
  - `POST /api/duties/admin-assign` — a single invigilator into one room.
  - `POST /api/duties/admin-assign-group` — a whole RS group (transactional, one duty per room).
  - `POST /api/dcs/groups/:id/admin-claim` — a whole DCS group (marks the persistent `DCSGroup` claimed and creates one duty per room).
  - Two admin surfaces feed these: **Manage Duties** (per-teacher wizard) and the **Exams room-detail modal** (see [CS Room-Detail Assignment](#cs-room-detail-assignment)).
- **Conflict detection** — every self-assign and admin-assign runs through two independent guards:
  - *Teacher conflict:* same teacher, same date, overlapping times → reject.
  - *Room conflict:* scoped by the room's ObjectId (`roomRef`) so the same room number in a *different building* does NOT collide, and scoped by role so DCS/RS/Invigilator slots on the same room are independent.

CS-assigned and self-claimed duties produce the **identical `Duty` record** — there is no separate "CS-only" duty. A duty the CS creates appears on the teacher's dashboard exactly like one they claimed themselves.

### CS Room-Detail Assignment
From **Exams → an exam → a classroom**, the room-detail modal (`frontend/src/modules/exams/components/DutyStatusModal.tsx`) lets CS assign each vacant role directly. Clicking a **Vacant** row opens a compact, role-specific panel under `frontend/src/modules/exams/components/cs-assign/`:

| Role | Grain | Panel | Backend path |
| --- | --- | --- | --- |
| **DCS** | Whole group | `CsDcsGroupAssignPanel` — resolves the persistent `DCSGroup` owning the room (rooms + student count) | `dcs/groups/:id/admin-claim` |
| **RS** | Whole group | `CsRsGroupAssignPanel` — derives the RS group with the *same* `groupRoomsIntoRSGroups` util the RS dashboard uses | `duties/admin-assign-group` |
| **Invigilator** | Single room | `CsInvigilatorAssignPanel` | `duties/admin-assign` |

Eligible teachers come from the centralized rule via `GET /users?role=<role>` — no CS-specific eligibility logic. Assignment is gated to CS (`activeRole === "cs"`) and only in the standalone Exams view, so the teacher-side Select Duty flow and the Manage-Duties wizard are untouched. On success, all duty-status caches refresh so the row flips from Vacant to Assigned in place, and the assigned teacher receives a `duty_assigned` notification.

### Duty Calculation (Targets & Progress)
The `duty-calculation` module (`backend/modules/duty-calculation/`) computes invigilation duty targets on demand — no caching — from live data:

```
Semester duties      = ceil((courses × students × examTypes) / avgRoomCapacity)
Department duties     = Σ semester duties
Institution duties    = Σ department duties
Duty per invigilator  = round(institution duties / eligible invigilators)
```

Only **Assistant** and **Associate Professors** (active, invigilator role) are eligible to carry a target. Distribution uses a **70/30 weighting** — an Associate's base target is `round(0.7 × assistant base)` — with any remainder duties handed to assistants one at a time in a stable `_id` order so the same teachers absorb extras across recomputes.

The same engine also derives **RS** and **DCS** targets from the same live data:

```
Total RS duties       = round(institution invigilator duties / 5)   # one RS ≈ 5 rooms
Per-RS split          = distribute across Professors (base x) + Associate Professors (0.7x)

Semester DCS duties   = ceil((courses × students × examTypes) / 300) # one DCS ≈ 300 students
Total DCS duties      = Σ semester DCS duties
Duty per DCS          = round(total DCS duties / HOD-Dean count)     # flat, no weighting
```

- **RS** — eligible pool is Professors + Associate Professors with the `rs` role; the 70/30 distributor is reused with Professor as the base role. Completed is counted in **groups** (RS claims a room group; per-room duties are collapsed by `schedule + building`, chunked by 5) so the number matches the group cards.
- **DCS** — eligible pool is HOD/Dean; target is a flat split. Completed is counted as claimed **DCS groups** whose schedule has ended (from the persistent `DCSGroup` collection). *Note:* this dashboard target is an aggregate `/300` figure and won't exactly equal the count of generated DCS groups (which uses a per-schedule `ceil(students/300)` — see [DCS Group Sizing](#dcs-group-sizing)).

- Backend: per-teacher progress (`/my-progress`, `/my-rs-progress`, `/my-dcs-progress`, `/teacher/:id/progress`), cohort (`/all-teachers`), institution summary (`/institution`), semester/department drill-down, and `POST /recalculate`.
- Frontend (`frontend/src/modules/duty-calculation/`): `useMyDutyProgress` / `useMyRsDutyProgress` / `useMyDcsDutyProgress` feed `DutyStatsHeroInline` / `RsDutyStatsHeroInline` / `DcsDutyStatsHeroInline` — thin role widgets over a shared presentational `HeroDutyCircles` (translucent Completed → Remaining → Assigned circles) slotted into each role's dashboard hero. All three share the `["duty-calculation"]` query root, so the mutations that already invalidate it (teacher CRUD, department/semester/course changes) auto-refresh every widget with no extra wiring. Admin analytics widgets/tables consume the cohort and institution endpoints.

### Change Requests
Every role can propose a change; **CS reviews (approves/rejects)** — DCS is an operational duty role and does not gate change requests. `request_submitted` notifications fan out to active CS users only; approve/reject fires `request_approved` / `request_rejected` back to the requester. Approval is atomic — either the whole change lands or nothing does.

| Scope | Type | Used by | Behavior on approval |
| --- | --- | --- | --- |
| `duty` | `swap` | Invigilator | Duty's `teacher` field flips to the swap partner. |
| `duty` | `drop` | Invigilator | Duty → cancelled. |
| `duty` | `move` | Invigilator | Old duty cancelled, new duty created on the target `examSchedule`/`examRoom`. |
| `dcs_group` | `dcs_swap` | DCS | Source group's duties cancelled, target group claimed for the requester. |
| `rs_group` | `rs_swap` | RS | Source group's duties cancelled, one new duty per target-group room created for the requester. |

RS groups aren't persisted server-side (they're derived from `schedule + building + chunk` on the client). The RS change request snapshots the source duty IDs and target `examRoom` IDs so approval can operate on a stable set of records.

### DCS Group Sizing
DCS supervision groups are generated at exam-creation time (in the same finalize call that creates the `ExamGroup`, `ExamSchedule`s, and `ExamRoom`s). Sizing is per-schedule and locked at creation:

- **N (DCS required per schedule)** — `ceil(totalStudents / 300)`.
- **`totalStudents`** — sum of `Semester.studentCount` for each unique `(department × examGroup.semester)` pair represented in that schedule's rooms. It uses the full semester roster, not per-subject registrations or attendance.
- **Room distribution** — rooms are sorted numerically and split into `N` chunks; when rooms don't divide evenly, the first few chunks each get one extra room.
- **Fallback** — a schedule with rooms but zero resolved students still gets one DCS group (never leave rooms unsupervised).

Formula source: `backend/modules/dcs/dcsCalculation.utils.js`. Generation entry point: `dcsGroupService.generateDCSGroupsForExamGroup(examGroupId)`, invoked from `finalizeCIEPlan` / `finalizeSEEPlan`. For exams created before the module existed (or when a resize is needed), run `node backend/scripts/backfill-dcs-groups.js` (add `--force` to wipe existing groups and regenerate).

### Seat Sharing
Exams that overlap in time can share leftover seats. During finalize, consumer exams detect overlapping shareable rooms and atomically decrement `remainingSeats` (with a `$gte` guard to prevent double-claim). Post-hoc marking, unmarking, and per-schedule allocation views are exposed under `/api/seat-sharing`.

### Notifications
Typed in-app notifications with a central emitter (`backend/modules/notification/notification.emitter.js`):

`duty_assigned`, `duty_group_assigned`, `duty_self_claimed`, `duty_cancelled`, `request_submitted`, `request_approved`, `request_rejected`, `duty_swapped`, `duty_reminder`, `target_reached`, `exam_created`, `exam_updated`, `exam_deleted_duty_release`, `announcement`, plus three CS-facing awareness alerts: `duty_claimed_by_teacher`, `duty_released_by_teacher`, `group_released`.

Notifications reference either a `Duty` or a `ChangeRequest` for deep-linking (broadcast `announcement`s reference neither). Unread count and read-all endpoints back the UI bell. Message text is stored at emit time, so wording is written to read correctly whenever it's opened later.

- **Room labels are building-aware** — assignment/reminder messages use the app-wide `"<Building> — <Room>"` label (via `buildRoomLabel`), so `Academic Block — 004` and `BSN Block — 004` never collide.
- **Group roles get one notification per group, not per room** — CS assigning an RS/DCS group fires a single `duty_group_assigned` ("…assigned a DCS group of 4 rooms…"), never one alert per room.
- **Daily reminder counts groups, not rooms** — the `duty_reminder` sweep (`notification.jobs.js`) collapses a teacher's duties into duty-units (an RS/DCS group counts once) and anchors the message to the **absolute date** rather than the word "tomorrow", so a stored reminder never goes stale when the day rolls over.
- **Self-claim is confirmed, not silent** — a teacher who selects a duty (single room, RS group, or DCS group) gets a `duty_self_claimed` confirmation, and CS gets a `duty_claimed_by_teacher` alert. Releasing raises `duty_released_by_teacher` / `group_released` for CS so a vacated room doesn't go unnoticed. CS-initiated cancellation does **not** raise these — the actor is passed into `cancelDuty` to tell the two apart.
- **Exam edits reach the people holding duties** — `PATCH /exam-groups/:id` fans out `exam_updated` to every teacher with a live duty under that group, but only when a *duty-relevant* field changed (dates, exam type, semester), so a cosmetic edit doesn't page everyone.
- **"Duty today" popup for teachers** — on every dashboard load (login/refresh), Invigilator/RS/DCS get a glass popup if they hold an assigned duty **today whose time hasn't passed**. It's computed live from the viewer's own duties (not the feed) and keyed by a per-page-load nonce so it re-appears each visit; CS has its own separate popup provider.

Teachers also see **co-assigned staff** for rooms where they hold a duty: the room-detail modal reveals the other roles' contacts (an invigilator sees that room's RS + DCS, etc.) so co-assigned staff can coordinate. Rooms where the viewer holds no duty keep occupied slots anonymous ("Occupied", no name) — only CS sees everyone everywhere.

### Email Notifications
Every notification is also delivered by email, hooked in at the single choke point (`notification.emitter.js`) so **every type — including ones added later — gets an email channel without touching its call site**.

Delivery uses a **transactional outbox** (`backend/modules/mail/`): `emit` writes an `EmailOutbox` row in the *same transaction* as the notification, and `mail.dispatcher.js` drains it every 20s (plus an immediate nudge for non-transactional emits). That ordering is what makes it safe:

- A rolled-back transaction takes its queued emails with it — no email about a duty that was never created.
- SMTP latency and outages stay off the request path; assigning a duty never waits on, or fails because of, a mail server.
- Every attempt is recorded with retries (1m → 5m → 15m → 1h, then `failed`), so "was this teacher actually told?" is answerable.

Per-type policy lives in `modules/mail/mail.policy.js`. Duty lifecycle events, change-request outcomes, reminders, and announcements email immediately; CS awareness alerts and `target_reached` are in-app only; `exam_created` is held back from email because one publish reaches every eligible teacher (a daily digest is planned). A type with no entry defaults to emailing, with a startup warning — the intent is that anything worth a bell is worth an inbox.

Transport is env-driven and defaults to **`console`**, which renders the mail and logs a one-line summary without sending:

```env
MAIL_ENABLED=true
MAIL_TRANSPORT=console          # console | gmail | smtp
MAIL_USER=you@gmail.com         # gmail/smtp only
MAIL_PASS=<app password>        # Gmail needs an App Password (2FA required)
MAIL_FROM="Proctavo <you@gmail.com>"
MAIL_HOST=smtp.example.com      # smtp transport only
MAIL_PORT=587
APP_URL=https://proctavo.com    # deep links in emails
```

Keep `console` locally and in CI — the seeded accounts use fake `@examduty.com` addresses that would bounce. Gmail App Passwords cap at roughly 500 recipients/day (about 2,000 on Workspace), so a transactional provider is the better target for institution-wide broadcasts; both sit behind the same interface, making the switch env-only.

Inspect delivery with `node scripts/mail-outbox-report.js` (`--failed` for errors only, `--retry` to re-queue failures).

### Calendar Invites
Every duty also lands in the teacher's own calendar (Google Calendar, Outlook, Apple) as a standard calendar invite emailed from the `MAIL_FROM` address — no calendar API access or per-teacher setup. One event per duty unit: an invigilator room, or a whole RS / DCS group. When a duty moves, the event moves; when it's unassigned, released, swapped away or its exam is deleted, a cancellation removes it.

It's a reconciliation, not a per-event hook (`backend/modules/calendar/`): the teacher's live upcoming duties are compared with what their calendar was last sent, and only the difference is emailed. It runs a few seconds after any duty notification and every 6 hours; the first run after deploy invites everyone for duties they already hold. Invites come **in addition to** the regular notification emails.

```env
CALENDAR_INVITES=               # unset: on with a real MAIL_TRANSPORT, off under console · true: force on · false: off
APP_TIMEZONE=Asia/Kolkata       # duty times are local wall-clock times
```

Verify with `MAIL_TRANSPORT=console node scripts/verify-calendar.js` against a throwaway database.

### Reminders, Confirmation & Responsiveness
- **Reminders** go out **3 days, 1 day and 30 minutes** before every duty (in-app + email), once per duty unit — a whole RS/DCS group is one reminder. A stage is skipped if the duty was assigned after it, and messages always name the date rather than "tomorrow". Calendar invites carry the same three alarms (Google Calendar ignores invite alarms and uses the teacher's own default, which is why the app's reminders matter).
- **Confirmation.** Duties CS assigns start *awaiting confirmation*; self-claimed duties (and change requests the teacher raised) are confirmed automatically. Teachers confirm with the **"Confirm I'll be there"** button in any duty email (a signed one-click link, no login) or on their dashboard; a whole group is confirmed at once. "Can't make it?" routes to the existing change-request flow.
- **Nudges.** Unconfirmed 24h after assignment → the teacher is reminded to confirm. Still unconfirmed the day before → CS gets an in-app alert. Below selection target while an exam with open slots starts within 7 days (and again at 3) → "please select your duties". Nothing is ever auto-released.
- **Reports → Responsiveness** (CS) lists, per teacher: upcoming duties, confirmed vs awaiting (with the oldest wait), average time to confirm, reminders received, selected vs target, and last activity, with a **Not responding** flag. Email opens are deliberately not tracked — they can't be measured reliably; confirmations can.

Time-critical checks run on a 5-minute tick. Verify with `MAIL_TRANSPORT=console node scripts/verify-reminders.js` against a throwaway database.

### Notify (Broadcast Announcements)
The **Notify** module (`backend/modules/notify/`, frontend `frontend/src/modules/notify/`) is a **CS-only** broadcast tool distinct from the automatic `notification` module. From the **Notify** page, CS composes a title + message and picks an audience:

- **All** — every active user (excluding the sender).
- **Role** — active users matching one or more selected roles.
- **Specific** — hand-picked individual teachers.

`POST /api/notify` resolves the recipient list and fans out `announcement` notifications via `emitToMany`, returning `{ sent, recipients }`. The UI is composed of `AudienceSelector`, `RoleMultiSelect`, `TeacherMultiSelect`, and `NotifyComposer`.

### Exam Cleanup
Deleting an exam group, schedule, or room cascades in a single transaction (`backend/modules/exam-cleanup/services/examDeletionService.js`): all dependent duties are cancelled, open change requests are marked `cancelled_exam_deleted`, seat-sharing allocations are released (and source rooms' `remainingSeats` restored), and affected teachers receive `exam_deleted_duty_release` notifications.

### Reports (CS)
The **Reports** page (`frontend/src/modules/reports/`) has two tabs, both CSV-exportable:

- **Duty Roster** — a room-by-room invigilation roster for a chosen exam, organised **day → shift**. Each room row shows its department(s) and the assigned DCS / RS / Invigilator with contact numbers, vacancies highlighted. Coverage tiles use **role-correct denominators**: invigilators are counted per room, but RS and DCS are counted per **duty group** (reusing `groupRoomsIntoRSGroups` for RS and the persistent `DCSGroup`s for DCS) so the "X vacant" figures reflect groups, not rooms. CSV export works at three scopes — whole exam, a single day, or a single shift — sharing one row builder so a room's line is identical regardless of which button produced it, with blank-row separators between shifts/days. Date, time, and room-number cells are wrapped as Excel text so leading zeros (`003`) and dates survive the import.
- **Teacher Workload** — a role-aware cohort table of duty targets vs completion. Filtering by role narrows to teachers eligible for that role and measures every row against **that role's** target/completed/remaining; with no role filter each teacher is measured against their own duty role(s), so an Associate Professor shows both an RS and an Invigilator row (identity spanned once, roles stacked). Rows sort DCS → RS → Invigilator (Professors before Associate Professors within RS). Three per-role donut charts summarise overall completion effectiveness. Department is a data-derived dropdown; CS and non-teaching ("Other") accounts are excluded.

### Audit Log (CS)
The **audit** module (`backend/modules/audit/`) records a who-did-what trail via fire-and-forget `logSafe` writes from controller hooks, surfaced on the CS **Audit Log** page. Teacher self-claims are intentionally hidden (CS cares about who *assigned* or *approved*, not routine pick-ups), and CS admin-assignments — single duty, RS group, and DCS group — all read as **"Duty assigned by CS"** under one filter. Filterable by action (a custom colour-dotted dropdown), date range, and paginated.

## Domain Model

Backend uses Mongoose models under `backend/modules/*/[name].model.js`.

| Model | Purpose |
| --- | --- |
| `User` | Auth principal with `roles: (cs \| dcs \| rs \| invigilator)[]`, `designation` (drives roles), `department`, `phone`, `isActive`. Passwords are bcrypt-hashed and `select: false`. |
| `Department` / `Semester` / `Course` / `ElectiveGroup` | Academic taxonomy. `Course.courseType ∈ {core, elective}` (electives belong to an `ElectiveGroup`, which is just a name). `Semester.studentCount` feeds DCS sizing and duty calculation. |
| `Building` / `Room` | Physical infrastructure. `Room` is unique per `(building, roomNumber)`. |
| `Exam` | Legacy single-exam entity. Retained for old flows; new work uses `ExamGroup`. |
| `ExamGroup` | Structured top-level: `examType ∈ {IA1, IA2, IA3, SEE}`, `semester`, date range. |
| `ExamSchedule` | One schedule per exam date; belongs to an `ExamGroup`. |
| `ExamRoom` | Allocates a physical `Room` to a `Schedule`, with per-department seat metadata. |
| `Duty` | Assignment of a teacher to a slot. Carries both `room` (string label, legacy) and `roomRef` (ObjectId → `Room`, building-aware), plus `role`, `assignedBy`, `isSelfAssigned`. Indexed on `(teacher, date, startTime, status)`, `(room, …)`, `(roomRef, …)`, and `(roomRef, role, …)`. |
| `DCSGroup` | Persistent supervision group sized by student count. Tracks `assignedRooms`, `assignedTeacher`, `duties`, `status ∈ {open, claimed, released}`. |
| `ChangeRequest` | `scope ∈ {duty, dcs_group, rs_group}` × `type ∈ {swap, drop, move, dcs_swap, rs_swap}`. RS scope snapshots `rsSourceDuties[]` + `rsTargetExamRooms[]` and a `rsSourceKey` (schedule:building:chunk) for uniqueness. |
| `Notification` | Typed in-app notification (`announcement` included for broadcasts). |
| `RoomSharingConfiguration` / `SharedSeatAllocation` | Seat-sharing pool + per-consumer allocation with atomic remaining-seats counter. |

## Workflows by Role

### CS — Administrator
1. **Bootstrap** the first admin via `POST /api/users/bootstrap`, log in.
2. Set up **Departments** (with semesters, courses, elective groups) and **Infrastructure** (buildings + rooms).
3. Create **Users** for faculty — pick a designation and the roles resolve automatically (or pick one role for `Other`).
4. Open **Create Exams**:
   - Pick CIE or SEE.
   - Select departments and semester, configure shifts and start date; dates auto-calculate.
   - Assign rooms per shift; the finalize call transactionally creates the `ExamGroup`, all `ExamSchedule`s, `ExamRoom`s, `DCSGroup`s (sized by student count), and any `RoomSharingConfiguration`s for overlapping shareable rooms.
5. **Assign duties directly** — from **Manage Duties** (per-teacher) or from the **Exams** room-detail modal (per role/group/room). See [CS Room-Detail Assignment](#cs-room-detail-assignment).
6. Review **Change Requests** — approve/reject `duty`, `dcs_group`, and `rs_group` scoped requests.
7. **Notify** — broadcast an announcement to everyone, a role group, or specific teachers.
8. Optionally delete an exam group/schedule/room — cascade releases all duties and notifies affected teachers.

### DCS — Group Supervisor
1. **Dashboard** — group-oriented hero band (upcoming groups, total rooms, total students).
2. **Select Duty** — browses `DCSGroup`s available for the exam; each group covers a subset of rooms in one schedule (sized so no DCS supervises more than 300 students) and lists its rooms. Claiming a group prompts for confirmation, then creates one `Duty` per room atomically.
3. **Upcoming Duties** — one card per claimed group with the room list and (per room) the assigned invigilator's contact.
4. **Change Requests** — swap a whole claimed group for another open group (`type = dcs_swap`). Cannot swap individual rooms.
5. **Exams** — read-only exam browser.

### RS — Room Group Supervisor
1. **Dashboard** — group-oriented hero band (upcoming groups, total rooms, buildings).
2. **Select Duty** — rooms are chunked into groups of 5 per `(examGroup, schedule, date, startTime, endTime, buildingId)` and sorted numerically. Claiming a group creates one `Duty` per room atomically.
3. **Upcoming Duties** — one card per group (`Academic Block — Rooms 004–412`) with per-room chips, not one card per room.
4. **Change Requests** — swap a whole group for another available RS group. Submits a single `rs_swap` request that snapshots source duty IDs + target `examRoom` IDs and a `rsSourceKey`; the unique index prevents double-swapping the same source group.
5. **Exams** — reuses the invigilator exam browser.

RS groups are derived (not persisted) using a stable partition key `${scheduleId}:${buildingId}:${chunkIndex}` — the same key format is used by Select Duty, Upcoming Duties, Change Requests, the Dashboard, and the CS room-detail RS assignment panel, so the RS group looks identical wherever it appears.

### Invigilator — Faculty
1. **Dashboard** — hero band with a live duty-progress widget (Completed / Remaining / Assigned) plus per-duty cards for upcoming and completed shifts.
2. **Select Duty** — grid or table of available room slots for the exam. Slots are filtered by:
   - Slot lifecycle (past schedules hidden).
   - Per-role occupancy (`flags.invigilatorAssigned`).
   - Teacher's own time conflicts (across all assigned duties).
   - Building-aware room identity (a duty on Academic Block 004 does **not** shadow Lab Block 004).
3. **Upcoming Duties** — one card per assigned duty, grouped by date and time slot.
4. **Change Requests** — submit `swap` (with a partner), `drop` (with reason), or `move` (to a listed vacant slot).
5. **Exams** — timetable with the invigilator's own duty highlighted.

## Project Structure

```
exam-duty/
├── backend/
│   ├── server.js                    # Entry — connects DB, starts server
│   ├── app.js                       # Express setup, CORS, route mounting
│   ├── modules/
│   │   ├── auth/                    # Register, login, /me, select-role, JWT
│   │   ├── user/                    # User CRUD, roles-by-designation, bootstrap, activate
│   │   ├── department/              # Dept + Semester + Course + ElectiveGroup
│   │   ├── infrastructure/          # Building + Room
│   │   ├── exam/                    # Legacy Exam + ExamGroup/Schedule/Room
│   │   ├── create-exams/            # CIE + SEE finalize (transactional)
│   │   ├── duty/                    # Assign/self-assign/admin-assign(-group), conflict scan
│   │   ├── dcs/                     # DCSGroup formation, claim, admin-claim, release
│   │   ├── change-request/          # duty / dcs_group / rs_group scopes
│   │   ├── seat-sharing/            # Shareable rooms + atomic allocation
│   │   ├── duty-calculation/        # Duty-target engine + per-teacher progress
│   │   ├── notification/            # Emitter + typed notifications
│   │   ├── notify/                  # CS broadcast announcements
│   │   ├── exam-cleanup/            # Cascade delete + release
│   │   ├── audit/                   # CS who-did-what trail (fire-and-forget writes)
│   │   └── report/                  # Stub (reporting UI lives on the frontend)
│   ├── scripts/                     # Seed + backfill + dump/restore + check-architecture
│   └── shared/                      # DB config, auth middleware, roleResolver, utils
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Router root — public + protected + role trees
│   │   ├── main.tsx                 # Vite entry, React Query provider
│   │   ├── modules/
│   │   │   ├── auth/                # Login, register, role-selection page + modal
│   │   │   ├── dashboard/           # Admin dashboard
│   │   │   ├── create-exams/        # CIE + SEE wizards, room allocation, sharing
│   │   │   ├── exams/               # List/filter/timetable + room-detail modal
│   │   │   │   └── components/cs-assign/  # CS direct-assignment panels (DCS/RS/invig)
│   │   │   ├── manage-duties/       # Per-teacher duty admin + assign wizard
│   │   │   ├── duty-calculation/    # Progress hooks + hero widget + analytics
│   │   │   ├── users/               # Teacher CRUD + row actions
│   │   │   ├── departments/         # Dept + sem + course admin
│   │   │   ├── infrastructure/      # Buildings + rooms
│   │   │   ├── change-requests/     # Admin review page
│   │   │   ├── reports/             # Duty Roster + Teacher Workload (CSV export)
│   │   │   ├── audit/               # CS audit-log page (filter + paginate)
│   │   │   ├── notifications/       # Bell + list
│   │   │   ├── notify/              # CS broadcast composer (audience + message)
│   │   │   ├── duties/              # Duty types + admin actions
│   │   │   ├── invigilator/         # Invigilator role tree (/invigilator/*)
│   │   │   ├── rs/                  # RS role tree — group-oriented (/rs/*)
│   │   │   ├── dcs/                 # DCS role tree — group-oriented (/dcs/*)
│   │   │   └── shared/
│   │   │       ├── change-requests/ # Shared ChangeRequestCard + types + hooks
│   │   │       ├── exams/           # Shared exam data hooks + selectors + grouping
│   │   │       ├── dashboard/       # Shared hero + section + normalizers
│   │   │       └── role-config/     # Per-role UI config (nav, flag key, path)
│   │   └── shared/
│   │       ├── components/          # AuthGuard, Sidebar, MainContent, Modal,
│   │       │                        #   ConfirmActionModal, ProtectedLayout
│   │       ├── store/               # Zustand auth + app stores
│   │       ├── lib/                 # Axios API client, types, navigation
│   │       └── ui/                  # Reusable primitives
│   └── package.json
│
├── README.md
├── APP_FLOW.md                      # End-to-end walkthrough
├── CREDENTIALS.md                   # Seeded test logins
├── NGROK_SETUP_GUIDE.md             # Optional public tunnel setup
└── db-dump.json                     # EJSON database export (see dump/restore scripts)
```

Each backend module follows the **controller → service → repository → model** pattern. Each frontend feature module owns its own `components/`, `hooks/`, `services/`, `types.ts`, and (where useful) `utils/` — cross-module imports are one-way toward `shared/`. These boundaries are machine-checked: `backend/scripts/check-architecture.js` (a CI gate) blocks new cross-domain `.model`/`.repository` imports, and `frontend/eslint.config.js` blocks undeclared feature→feature imports.

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB running locally (or a connection URI to a remote instance)

### Setup

```bash
git clone <repository-url>
cd exam-duty
```

**Backend**
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/exam-duty
NODE_ENV=development
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d

# Email — `console` renders without sending. See "Email Notifications".
MAIL_ENABLED=true
MAIL_TRANSPORT=console
MAIL_FROM="Proctavo <no-reply@proctavo.com>"
APP_URL=http://localhost:5173
```

**Frontend**
```bash
cd ../frontend
npm install
```

(No `.env` needed for local dev — the axios client defaults to `/api` via the Vite proxy at `http://localhost:5000`. Override with `VITE_API_URL` if needed.)

### Running

```bash
# Terminal 1 — backend (hot-reloaded)
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

### Seed Data

```bash
cd backend
node scripts/seed-users.js         # Test logins (see CREDENTIALS.md)
node scripts/seed-departments.js   # 5 departments × 8 semesters + core courses
node scripts/seed-electives.js     # 2+ electives per (dept, sem)
node scripts/fix-elective-groups.js # Group electives under ElectiveGroup docs
node scripts/seed-rooms.js         # Buildings + rooms
```

Test credentials (from `CREDENTIALS.md`):

| Role | Email | Password |
| --- | --- | --- |
| CS | `admin@examduty.com` | `Admin123` |
| DCS | `dcs@examduty.com` | `Dcs12345` |
| RS | `rs@examduty.com` | `Rs123456` |
| Invigilator | `invigilator@examduty.com` | `Invig123` |

### Database Backup & Restore

Snapshot every collection to Extended JSON (preserves `ObjectId`/`Date`), and restore it later:

```bash
cd backend
node scripts/dump-database.js [output-path]        # default: ../db-dump.json
node scripts/restore-database.js [input-path] [--drop]  # --drop wipes each collection first
```

`restore` uses unordered `insertMany`, so without `--drop` existing `_id`s will collide — pass `--drop` for a clean reload.

### Optional: Ngrok

To expose the app externally, run the frontend in production mode (dev server HMR breaks through the tunnel) and expose port 3001:

```bash
cd frontend && npx vite build && npx vite preview --port 3001
ngrok http 3001
```

See `NGROK_SETUP_GUIDE.md` for troubleshooting.

## API Reference

All endpoints are prefixed with `/api`. All routes except `POST /auth/register`, `POST /auth/login`, and `POST /users/bootstrap` require a `Bearer <token>` header. `POST /auth/select-role` accepts the `tempToken` issued at login.

### Auth (`/auth`)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/register` | Create a user account; returns `{ user, token }` or `{ user, tempToken, requiresRoleSelection }`. |
| POST | `/login` | Same shape as register — full token for single-role, tempToken for multi-role. |
| POST | `/select-role` | Multi-role user picks an active role (`{ role }`); returns the full token. |
| GET | `/me` | Current user profile with the active role. |

### Users (`/users`)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/bootstrap` | Create the first admin — no auth. |
| POST | `/` | Create user. Requires `designation`; roles are resolved from it (or one role when `Other`). |
| GET | `/` | List users. `?role=<role>` filters by roles-array membership; `?department=<code>`; `?includeInactive=true` includes deactivated users. |
| GET | `/:id` | Get by id. |
| PUT | `/:id` | Update. Changing `designation` re-resolves roles; roles can't be written directly otherwise. |
| DELETE | `/:id` | Two-step delete: an **active** user is soft-deleted (`isActive=false`); an **already-deactivated** user is **permanently** removed. |
| PATCH | `/:id/activate` | Reactivate a soft-deleted user (bypasses the auto-active-only pre-find hook). |

### Exams (legacy, `/exams`)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/` · GET `/` · GET `/:id` · PUT `/:id` | CRUD. |
| PATCH | `/:id/cancel` · `/:id/restore` | Lifecycle. |

### Exam Groups (`/exam-groups`)
| Method | Path | Description |
| --- | --- | --- |
| POST/GET/PATCH/DELETE | `/` · `/:id` | Group CRUD. |
| GET | `/:id/details` | Group + schedules + rooms. |
| GET | `/:id/duty-status` | Per-room role occupancy flags + assignee snapshots. |
| POST/GET/DELETE | `/schedules` · `/schedules/:id` | Schedule ops. |
| POST/GET/DELETE | `/rooms` · `/rooms/:id` | Exam room ops. |
| POST | `/room-availability` | Check demand vs capacity. |

### Create Exams (`/create-exams`)
| Method | Path | Description |
| --- | --- | --- |
| GET | `/cie/departments-data` | Depts + semesters + courses for a semester. |
| POST | `/cie/calculate-dates` | Auto-calculate dates from shifts. |
| GET | `/cie/rooms` | Available rooms by building. |
| POST | `/cie/finalize` | One-call: create group + schedules + rooms + DCS groups + sharing config. |
| POST | `/see/finalize` | SEE equivalent. |

### Duties (`/duties`)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/self-assign` | Invigilator self-assign (single room). |
| POST | `/self-assign-group` | RS/DCS self-assign a whole group. |
| POST | `/admin-assign` | CS assigns a teacher to a single slot (pass `role` to disambiguate multi-role teachers). |
| POST | `/admin-assign-group` | CS assigns a whole group (RS) to a teacher; notifies per room. |
| POST | `/invigilators-for-rooms` | Look up assigned invigilators for a set of rooms. |
| GET | `/` · `/:id` | List / get. |
| PATCH | `/:id/cancel` | Cancel with notification. |

### DCS Groups (`/dcs`)
| Method | Path | Description |
| --- | --- | --- |
| GET | `/groups` · `/groups/mine` · `/groups/:id` | List (filter by `examGroup`/`schedule`/`status`) / mine / by id. |
| GET | `/groups/:id/invigilators` | Contact list for rooms in the group. |
| POST | `/groups/:id/claim` | DCS self-claims the group. |
| POST | `/groups/:id/admin-claim` | CS assigns the group to a teacher (`{ teacher }`); notifies per room. |
| POST | `/groups/:id/release` | Release a claimed group. |

### Change Requests (`/change-requests`)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/` | Submit — routes internally by `type` (`swap`/`drop`/`move`/`dcs_swap`/`rs_swap`). |
| GET | `/` · `/mine` · `/:id` | List all / mine / by id. |
| GET | `/replacements/:dutyId` | Vacant invigilator slots eligible for a `move`. |
| PATCH | `/:id/approve` · `/:id/reject` | Review (CS). |

### Duty Calculation (`/duty-calculation`)
| Method | Path | Description |
| --- | --- | --- |
| GET | `/my-progress` | Current user's invigilator target / completed / remaining. |
| GET | `/my-rs-progress` | Current user's RS target / completed (groups) / remaining. |
| GET | `/my-dcs-progress` | Current user's DCS target / completed (groups) / remaining. |
| GET | `/teacher/:teacherId/progress` | A specific teacher's progress. |
| GET | `/all-teachers` | Cohort progress, role-aware. `?role` narrows to that role and measures against it; with no role each teacher is measured against their own duty role(s). CS and `Other`-designation accounts are excluded. |
| GET | `/institution` | Institution-wide duty summary. |
| GET | `/semester/:semesterId` · `/department/:departmentId` | Drill-down breakdowns. |
| POST | `/recalculate` | Force a fresh institution-wide computation. |

### Departments (`/departments`)
CRUD for `Department`, `Semester` (`/semesters`), `ElectiveGroup` (`/elective-groups`), `Course` (`/courses`). Plus `GET /:id/stats`.

### Infrastructure (`/infrastructure`)
| Method | Path | Description |
| --- | --- | --- |
| POST/GET/DELETE | `/buildings` · `/buildings/:id` | Building ops. |
| GET | `/buildings/:buildingId/rooms` | Rooms in a building. |
| POST | `/rooms` · `/rooms/bulk` | Create single / batch. |
| PATCH/DELETE | `/rooms/:id` | Update / delete. |

### Seat Sharing (`/seat-sharing`)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/available` | Find overlapping shareable rooms for a consumer schedule. |
| POST | `/mark-shareable` · `/unmark-shareable` | Post-hoc toggle. |
| DELETE | `/allocations/:id` | Release an allocation (restores remainingSeats). |
| GET | `/by-exam-room/:examRoomId` · `/by-schedule/:scheduleId` | Read views. |

### Notifications (`/notifications`)
| Method | Path | Description |
| --- | --- | --- |
| GET | `/` · `/unread-count` | Read. |
| PATCH | `/read-all` · `/:id/read` | Mark read. |
| DELETE | `/` · `/:id` | Delete all / one. |

### Notify (`/notify`)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/` | CS-only broadcast. `{ audience: "all"\|"role"\|"specific", title, message, roles?, userIds? }` → fans out `announcement` notifications, returns `{ sent, recipients }`. |

### Audit (`/audit`)
| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | CS who-did-what trail. Filters: `?action` (single or comma-separated list, matched with `$in`), `?from`/`?to` (date range), `?page`/`?limit`. Teacher self-claim actions are excluded server-side. |

## Key Design Decisions

- **Modular architecture, enforced in CI** — every backend domain is a controller → service → repository → model tuple, with no cross-domain repository calls. `backend/scripts/check-architecture.js` is a blocking CI gate that fails on any _new_ cross-domain `.model`/`.repository` import (the existing set is baselined and burned down over time; services call other domains' services instead). Every frontend feature module owns its full slice (components, hooks, services, types), and `frontend/eslint.config.js` enforces one-way imports toward `shared/`: a feature may import `shared`, the `duties` domain, and `exams/types`; any other feature→feature edge must be an explicit, commented `LEGACY_ALLOW` entry.
- **Designation-driven, multi-role auth** — role eligibility lives in one `roleResolver`; a user's roles are derived from their designation, and a per-session `activeRole` (carried in the JWT) drives routing and authorization. Multi-role users select or switch their active role via `POST /auth/select-role`.
- **One duty record, two entry points** — a duty the CS assigns (Manage Duties or the Exams room-detail modal) is the same `Duty` a teacher would self-claim. The CS flow reuses the same eligibility, grouping, conflict, and notification services rather than duplicating them.
- **Building-aware conflict detection** — `Duty` carries both a legacy string label (`room`) and a physical room reference (`roomRef`). All conflict queries prefer `roomRef` so the same room number in different buildings can be booked independently. Frontend selection utilities compare via `examRoom.room._id` for the same reason.
- **Per-role slot independence** — one physical room can host all three roles at once (DCS supervisor, RS, invigilator). Conflict scans filter by the caller's role so filling one role's slot never blocks another.
- **Group parity for group roles** — RS and DCS see groups everywhere (Select Duty, Upcoming Duties, Change Requests, Dashboard, and the CS room-detail assignment panel). The same partition key format (`scheduleId:buildingId:chunkIndex` for RS, persistent `DCSGroup._id` for DCS) is used across all surfaces so a group looks identical wherever it appears.
- **Transactional group operations** — RS/DCS claim, admin-assign-group, and group-swap approvals use `withOptionalTransaction` so a partial write is impossible on replica-set deployments (and cleanly re-runnable on standalone Mongo).
- **On-demand duty targets** — duty-calculation never caches; every read recomputes from live data so analytics can't drift, with a stable distribution order so extras land on the same teachers across refreshes.
- **Soft deletes with pre-hooks** — `Exam` and `User` are soft-deleted; Mongoose pre-hooks exclude them from find queries automatically (with explicit bypasses for the reactivate/`includeInactive` paths).
- **Notification decoupling** — a central emitter (`notification.emitter.js`) with typed templates lets any service emit without knowing about the notification schema; `emitToMany` powers CS broadcasts.
- **Client-derived RS groups** — RS groups exist only as computed views over the same `AvailableDutySlot` list Select Duty consumes; group swap and CS group assignment snapshot the concrete IDs at submit time so the operation always has a stable target.

## Recent Enhancements

- **Enforced module boundaries** — `backend/scripts/check-architecture.js` is a new blocking CI job (`.github/workflows/ci.yml`) that fails on any _new_ cross-domain `.model`/`.repository` import; the current set is baselined for incremental burn-down (run with `--update` to regenerate the baseline). This mirrors the frontend's ESLint boundary rules. As part of the same pass, the shared `DutyGroup*` components were inverted to consume a role-agnostic `DutyGroupSummary` — the role→summary adapters now live in the `dcs`/`rs` modules — so `modules/shared` no longer imports any role module.
- **Reports module** — a CS **Duty Roster** (day → shift room roster with per-scope CSV export, group-correct coverage tiles, department per room) and a role-aware **Teacher Workload** table (per-role targets, one row per duty role, DCS → RS → Invigilator sort, per-role completion donuts). See [Reports](#reports-cs).
- **Role-aware workload + DCS counting fix** — the cohort endpoint (`/all-teachers`) now measures each teacher against the correct role instead of always invigilator, and DCS completion counts **groups** (via `DCSGroup`) rather than per-room duties (which had inflated the figure). The invigilator "completed" counter is role-scoped so RS/DCS room duties can't leak in.
- **Audit Log** — a CS who-did-what trail (`/audit`); self-claims hidden, CS assignments (single / RS group / DCS group) unified as "Duty assigned by CS", custom filter dropdown. See [Audit Log](#audit-log-cs).
- **"Duty today" popup + co-assignee visibility** — teachers get a dashboard popup for a duty happening today, and can see the other roles' contacts in rooms where they hold a duty (see [Notifications](#notifications)).
- **Permanent teacher delete** — deleting an already-deactivated teacher now removes the record for good (`node backend/scripts/purge-inactive-users.js` bulk-purges inactive accounts, skipping any with live duties); the teacher directory dropped its Status column and drops the synthetic teacher-ID display everywhere.
- **RS & DCS duty dashboards** — the duty-calculation engine now derives RS targets (`invigilator total ÷ 5`, Professor/Associate 70/30 split) and DCS targets (`Σ ceil(courses×students×examTypes / 300)`, flat across HOD/Dean). New `RsDutyStatsHeroInline` / `DcsDutyStatsHeroInline` widgets reuse a shared `HeroDutyCircles`; completed is counted in **groups** for both. Endpoints: `GET /duty-calculation/my-rs-progress`, `/my-dcs-progress`.
- **Assistant Professor is Invigilator-only** — RS removed from the Assistant Professor designation in both `roleResolver` copies, with a migration (`strip-rs-from-assistant-professors.js`) for existing records.
- **Contact everywhere (Call + WhatsApp)** — a shared `ContactActions` component (tap-to-dial + `wa.me`, inlined WhatsApp glyph) surfaces highlighted phone/email in the DCS & RS invigilator cards, the CS teacher table (new Contact column + phone search), the Manage-Duties teacher banner, and the Duty-Status modal. `backfill-user-phones.js` fills seeded accounts that had no number.
- **Group-aware notifications** — one `duty_group_assigned` per RS/DCS group instead of per room; building-aware room labels; and a `duty_reminder` sweep that counts groups and uses absolute dates so reminders never read "tomorrow" once the day passes.
- **End-time-aware upcoming/completed split** — a shared `isDutyUpcoming(date, endTime)` (`shared/duties/utils/dutyTiming.ts`) moves a duty from Upcoming to Completed the moment its end time passes, consistently across dashboards and the invigilator/RS/DCS Upcoming Duties pages.
- **CS dashboard popup policy** — change-request and assignment-alert popups show on every dashboard open; all other reminders show only once per page load (login/refresh), gated by a module-level seen-set.
- **CS direct duty assignment from Exams** — the room-detail modal lets CS assign each vacant role inline: an invigilator per room, an RS group, or a DCS group, via dedicated `cs-assign/` panels. Reuses the shared eligibility (`GET /users?role=`), the RS grouping util, the persistent DCS groups, conflict validation, and notifications — no CS-specific duplication. Backed by `POST /duties/admin-assign-group` and `POST /dcs/groups/:id/admin-claim`.
- **Duty-calculation engine** — per-semester → department → institution duty targets with Assistant/Associate 70/30 distribution, per-teacher progress endpoints, and dashboard/analytics widgets (`DutyStatsHeroInline`, progress circles, analytics tables).
- **CS broadcast Notify** — a CS-only announcement composer (all / by-role / specific-teachers) that fans out `announcement` notifications through `emitToMany`.
- **Multi-role accounts** — users hold a `roles` array derived from designation; login issues a tempToken for role selection, and a `RoleSelectionModal` lets users switch active role mid-session.
- **DCS supervision module** — persistent `DCSGroup` collection with per-schedule sizing (`ceil(students / 300)`), deterministic room distribution, claim/admin-claim/release lifecycle, per-group invigilator contact lookup, and `dcs_swap` change-request type. A `backfill-dcs-groups.js` script backfills legacy `ExamGroup`s.
- **Building-aware conflict detection** across the entire duty stack (model, repository, service, `examGroup.getDutyStatus`, `changeRequest.isInvigilatorAlreadyAssigned`, invigilator frontend selection utilities).
- **RS group-based UI parity** — Upcoming Duties, Change Requests, Dashboard, and CS assignment all render one card per RS group. Backend gained `rs_group` scope and `rs_swap` type on `ChangeRequest` with atomic approval, and `Duty` gained an indexed `roomRef` field for building-scoped queries.
- **Reactivate soft-deleted teachers** — the Teachers admin page opts into `GET /users?includeInactive=true`, sorts deactivated users to the bottom, and exposes row actions (`TeacherRowActions`) with typed confirmation modals; reactivation goes through `PATCH /users/:id/activate`.
- **Sidebar-aware layout** — `MainContent` reads `sidebarOpen` from the app store and toggles the main column's margin, so collapsing the sidebar reclaims horizontal space across all four role layouts.
- **Shared confirmation gate** — every self-assign path routes its submit through `ConfirmActionModal` on top of the portalled, propagation-safe shared `Modal`.
- **Exam timetable polish** — highlighted date headers, time-slot headers, and a highlighted **Department** filter make the CS Exams view easier to scan.
- **Database backup tooling** — `dump-database.js` / `restore-database.js` export and restore all collections as Extended JSON.

## Contributing

Follow the existing patterns:
- Add a new backend feature under `backend/modules/<domain>/` with `.controller.js`, `.service.js`, `.repository.js`, `.model.js`, `.routes.js`.
- Mount the route in `backend/app.js`.
- Add a matching frontend module under `frontend/src/modules/<domain>/` with `pages/`, `components/`, `hooks/`, `services/`, `types.ts`.
- Cross-role behavior goes under `frontend/src/modules/shared/`.
- Prefer using `roomRef` (ObjectId) over `room` (string) for any building-sensitive query.
- Reuse the centralized `roleResolver` for eligibility and `notification.emitter.js` for user-visible state changes — don't duplicate that logic.
- Respect module boundaries: a backend module must call another domain's **service**, never its repository/model directly — `node backend/scripts/check-architecture.js` enforces this in CI. On the frontend, import one-way toward `shared/`; if a new feature→feature import is truly unavoidable, add it to `LEGACY_ALLOW` in `frontend/eslint.config.js` with a comment (`npm run lint` flags undeclared ones).
