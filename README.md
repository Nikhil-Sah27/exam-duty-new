# Exam Duty

A role-based web application for planning exams and distributing invigilation duties across an academic institution. Administrators plan exam schedules and allocate rooms; supervision staff (CS, DCS, RS) manage groups of rooms; invigilators claim or swap individual duties. Every action flows through building-aware conflict detection, per-role slot independence, and an approval workflow for changes.

## Roles

Every user belongs to exactly one of four roles. Roles are stored on the `User` document (`backend/modules/auth/auth.model.js`) and drive both backend authorization and the frontend route tree.

| Role | Full Name | Grain | Responsibilities |
| --- | --- | --- | --- |
| **CS** | Controller of Superintendents | System | Full admin — creates exams, departments, rooms, users; reviews change requests; assigns duties directly. |
| **DCS** | Deputy Controller of Superintendents | Room *group* (student-count sized, one DCS per ≤300 students) | Claims a supervision group; oversees every room in the group; can approve change requests. |
| **RS** | Room Superintendent | Room *group* (chunks of ≤5 rooms per building + time slot) | Claims a room group; supervises up to 5 rooms in the same block during a shift. |
| **Invigilator** | Faculty Invigilator | Single room | Self-assigns or is assigned a single room per time slot; submits change requests. |

Group vs. individual is the key mental model: **DCS and RS work on whole groups**; **Invigilators work on individual rooms**. Every screen a group role sees — Select Duty, Upcoming Duties, Change Requests, Dashboard — is grouped, never per-room.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vite 6 · React 19 · TypeScript 5 · Tailwind CSS 4 · React Router 7 |
| State | Zustand (client state) · TanStack React Query (server cache) |
| Backend | Node.js · Express 4 |
| Database | MongoDB (Mongoose ODM) |
| Auth | JWT (bcrypt-hashed passwords) |
| Dev | nodemon (backend hot-reload) · Vite HMR (frontend) |

## Feature Overview

### Exam Planning (CS)
- **Create Exams** wizard for both CIE (IA1/IA2/IA3) and SEE (Semester End). Handles department selection, date auto-calculation from shifts, room allocation, seat-sharing configuration, and DCS group formation in a single transactional finalize call.
- **Exams** — list, filter, edit; timetable per exam with per-room duty status.
- **Departments** — CRUD for departments, semesters, courses (core / professional elective / open elective), and elective groups.
- **Infrastructure** — buildings and rooms with capacity, floor, and bulk-import support.
- **Users** — teacher profiles with role and department; one-time admin bootstrap endpoint.

### Duty Assignment
- **Admin-assign** — CS can force any teacher into any slot (`POST /api/duties/admin-assign`).
- **Self-assign** — Invigilators claim single rooms; RS and DCS claim groups (one API call creates a duty per room in the group, transactionally).
- **Conflict detection** — every self-assign and admin-assign runs through two independent guards:
  - *Teacher conflict:* same teacher, same date, overlapping times → reject.
  - *Room conflict:* scoped by the room's ObjectId (`roomRef`) so the same room number in a *different building* does NOT collide, and scoped by role so DCS/RS/Invigilator slots on the same room are independent.

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

`duty_assigned`, `duty_cancelled`, `request_submitted`, `request_approved`, `request_rejected`, `duty_swapped`, `exam_deleted_duty_release`.

Notifications reference either a `Duty` or a `ChangeRequest` for deep-linking. Unread count and read-all endpoints back the UI bell.

### Exam Cleanup
Deleting an exam group, schedule, or room cascades in a single transaction (`backend/modules/exam-cleanup/services/examDeletionService.js`): all dependent duties are cancelled, open change requests are marked `cancelled_exam_deleted`, seat-sharing allocations are released (and source rooms' `remainingSeats` restored), and affected teachers receive `exam_deleted_duty_release` notifications.

## Domain Model

Backend uses Mongoose models under `backend/modules/*/[name].model.js`.

| Model | Purpose |
| --- | --- |
| `User` | Auth principal with `role: cs | dcs | rs | invigilator`, department, designation, `isActive`. |
| `Department` / `Semester` / `Course` / `ElectiveGroup` | Academic taxonomy. `Course.courseType ∈ {core, professional_elective, open_elective}`. |
| `Building` / `Room` | Physical infrastructure. `Room` is unique per `(building, roomNumber)`. |
| `Exam` | Legacy single-exam entity. Retained for old flows; new work uses `ExamGroup`. |
| `ExamGroup` | Structured top-level: `examType ∈ {IA1, IA2, IA3, SEE}`, `semester`, date range. |
| `ExamSchedule` | One schedule per exam date; belongs to an `ExamGroup`. |
| `ExamRoom` | Allocates a physical `Room` to a `Schedule`, with per-department seat metadata. |
| `Duty` | Assignment of a teacher to a slot. Carries both `room` (string label, legacy) and `roomRef` (ObjectId → `Room`, building-aware). Indexed on `(teacher, date, startTime, status)`, `(room, …)`, and `(roomRef, …)`. |
| `DCSGroup` | Persistent supervision group sized by student count. Tracks `assignedRooms`, `assignedTeacher`, `duties`, `status ∈ {open, claimed, released}`. |
| `ChangeRequest` | `scope ∈ {duty, dcs_group, rs_group}` × `type ∈ {swap, drop, move, dcs_swap, rs_swap}`. RS scope snapshots `rsSourceDuties[]` + `rsTargetExamRooms[]` and a `rsSourceKey` (schedule:building:chunk) for uniqueness. |
| `Notification` | Typed in-app notification. |
| `RoomSharingConfiguration` / `SharedSeatAllocation` | Seat-sharing pool + per-consumer allocation with atomic remaining-seats counter. |

## Workflows by Role

### CS — Administrator
1. **Bootstrap** the first admin via `POST /api/users/bootstrap`, log in.
2. Set up **Departments** (with semesters, courses, elective groups) and **Infrastructure** (buildings + rooms).
3. Create **Users** for faculty and assign roles.
4. Open **Create Exams**:
   - Pick CIE or SEE.
   - Select departments and semester, configure shifts and start date; dates auto-calculate.
   - Assign rooms per shift; the finalize call transactionally creates the `ExamGroup`, all `ExamSchedule`s, `ExamRoom`s, `DCSGroup`s (sized by student count), and any `RoomSharingConfiguration`s for overlapping shareable rooms.
5. Optionally **admin-assign** duties directly from **Manage Duties**.
6. Review **Change Requests** — approve/reject `duty`, `dcs_group`, and `rs_group` scoped requests.
7. Optionally delete an exam group/schedule/room — cascade releases all duties and notifies affected teachers.

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

RS groups are derived (not persisted) using a stable partition key `${scheduleId}:${buildingId}:${chunkIndex}` — the same key format is used by Select Duty, Upcoming Duties, Change Requests, and the Dashboard, so the RS sees a consistent group across every surface.

### Invigilator — Faculty
1. **Dashboard** — per-duty cards for upcoming and completed shifts.
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
│   │   ├── auth/                    # Register, login, JWT, /me
│   │   ├── user/                    # User CRUD, bootstrap
│   │   ├── department/              # Dept + Semester + Course + ElectiveGroup
│   │   ├── infrastructure/          # Building + Room
│   │   ├── exam/                    # Legacy Exam + ExamGroup/Schedule/Room
│   │   ├── create-exams/            # CIE + SEE finalize (transactional)
│   │   ├── duty/                    # Assign/self-assign/cancel, conflict scan
│   │   ├── dcs/                     # DCSGroup formation, claim, release
│   │   ├── change-request/          # duty / dcs_group / rs_group scopes
│   │   ├── seat-sharing/            # Shareable rooms + atomic allocation
│   │   ├── notification/            # Emitter + typed notifications
│   │   ├── exam-cleanup/            # Cascade delete + release
│   │   ├── audit/                   # Stub
│   │   └── report/                  # Stub
│   ├── scripts/                     # Seed + backfill helpers
│   └── shared/                      # DB config, auth middleware, utils
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Router root — public + protected + role trees
│   │   ├── main.tsx                 # Vite entry, React Query provider
│   │   ├── modules/
│   │   │   ├── auth/                # Login form + hooks
│   │   │   ├── dashboard/           # Admin dashboard
│   │   │   ├── create-exams/        # CIE + SEE wizards, room allocation, sharing
│   │   │   ├── exams/               # List/filter/timetable
│   │   │   ├── manage-duties/       # Per-teacher duty admin
│   │   │   ├── users/               # Teacher CRUD
│   │   │   ├── departments/         # Dept + sem + course admin
│   │   │   ├── infrastructure/      # Buildings + rooms
│   │   │   ├── change-requests/     # Admin review page
│   │   │   ├── notifications/       # Bell + list
│   │   │   ├── duties/              # Duty types + admin actions
│   │   │   ├── invigilator/         # Invigilator role tree
│   │   │   │   ├── routes/          # /invigilator/*
│   │   │   │   ├── exams/           # Exam list + details
│   │   │   │   ├── select-duty/     # Per-room grid picker
│   │   │   │   ├── upcoming-duties/ # Per-room cards
│   │   │   │   ├── change-requests/ # Per-duty swap/move/drop
│   │   │   │   └── duties/          # dutySelectionUtils (building-aware match)
│   │   │   ├── rs/                  # RS role tree — group-oriented
│   │   │   │   ├── routes/          # /rs/*
│   │   │   │   ├── pages/           # Dashboard (uses group normalizers)
│   │   │   │   ├── select-duty/     # Group-of-5 picker
│   │   │   │   ├── upcoming-duties/ # Group cards + range labels
│   │   │   │   └── change-requests/ # Group swap (rs_swap)
│   │   │   ├── dcs/                 # DCS role tree — group-oriented
│   │   │   │   ├── routes/          # /dcs/*
│   │   │   │   ├── pages/           # Dashboard (uses DCS group normalizers)
│   │   │   │   ├── select-duty/     # Student-count-sized groups
│   │   │   │   ├── upcoming-duties/ # Group cards + invigilator contact list
│   │   │   │   └── change-requests/ # Group swap (dcs_swap)
│   │   │   └── shared/
│   │   │       ├── change-requests/ # Shared ChangeRequestCard + types + hooks
│   │   │       ├── exams/           # Shared exam data hooks + selectors
│   │   │       ├── dashboard/       # Shared hero + section + normalizers
│   │   │       └── role-config/     # Per-role UI config (nav, flag key, path)
│   │   └── shared/
│   │       ├── components/          # AuthGuard, Sidebar, ProtectedLayout
│   │       ├── store/               # Zustand auth + app stores
│   │       ├── lib/                 # Axios API client, types, navigation
│   │       └── ui/                  # Reusable primitives
│   └── package.json
│
├── README.md
├── APP_FLOW.md                      # End-to-end walkthrough
├── CREDENTIALS.md                   # Seeded test logins
└── NGROK_SETUP_GUIDE.md             # Optional public tunnel setup
```

Each backend module follows the **controller → service → repository → model** pattern. Each frontend feature module owns its own `components/`, `hooks/`, `services/`, `types.ts`, and (where useful) `utils/` — cross-module imports are one-way from role-specific → shared.

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
```

**Frontend**
```bash
cd ../frontend
npm install
```

(No `.env` needed for local dev — the Vite proxy points at `http://localhost:5000` by default.)

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

### Optional: Ngrok

To expose the app externally, run the frontend in production mode (dev server HMR breaks through the tunnel) and expose port 3001:

```bash
cd frontend && npx vite build && npx vite preview --port 3001
ngrok http 3001
```

See `NGROK_SETUP_GUIDE.md` for troubleshooting.

## API Reference

All endpoints are prefixed with `/api`. All routes except `POST /auth/register`, `POST /auth/login`, and `POST /users/bootstrap` require a `Bearer <token>` header.

### Auth (`/auth`)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/register` | Create a user account. |
| POST | `/login` | Return `{ user, token }`. |
| GET | `/me` | Current user profile. |

### Users (`/users`)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/bootstrap` | Create the first admin — no auth. |
| POST | `/` | Create user. |
| GET | `/` | List users. Add `?includeInactive=true` to include deactivated users (Teachers admin page). |
| GET | `/:id` | Get by id. |
| PUT | `/:id` | Update. |
| DELETE | `/:id` | Soft delete (sets `isActive=false`). |
| PATCH | `/:id/activate` | Reactivate a soft-deleted user (explicitly bypasses the auto-active-only pre-find hook). |

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
| GET | `/:id/duty-status` | Per-room role occupancy flags. |
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
| POST | `/admin-assign` | CS forces a teacher into a slot. |
| GET | `/` · `/:id` | List / get. |
| PATCH | `/:id/cancel` | Cancel with notification. |

### DCS Groups (`/dcs`)
| Method | Path | Description |
| --- | --- | --- |
| GET | `/groups` · `/groups/mine` · `/groups/:id` | List / mine / by id. |
| GET | `/groups/:id/invigilators` | Contact list for rooms in the group. |
| POST | `/groups/:id/claim` · `/groups/:id/release` | Ownership lifecycle. |

### Change Requests (`/change-requests`)
| Method | Path | Description |
| --- | --- | --- |
| POST | `/` | Submit — routes internally by `type` (`swap`/`drop`/`move`/`dcs_swap`/`rs_swap`). |
| GET | `/` · `/mine` · `/:id` | List all / mine / by id. |
| GET | `/replacements/:dutyId` | Vacant invigilator slots eligible for a `move`. |
| PATCH | `/:id/approve` · `/:id/reject` | Review (CS). |

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

## Key Design Decisions

- **Modular architecture** — every backend domain is a controller → service → repository → model tuple, with no cross-domain repository calls. Every frontend feature module owns its full slice (components, hooks, services, types).
- **Building-aware conflict detection** — `Duty` carries both a legacy string label (`room`) and a physical room reference (`roomRef`). All conflict queries prefer `roomRef` so the same room number in different buildings can be booked independently. Frontend selection utilities compare via `examRoom.room._id` for the same reason.
- **Per-role slot independence** — one physical room can host all three roles at once (DCS supervisor, RS, invigilator). Conflict scans filter by the caller's role so filling one role's slot never blocks another.
- **Group parity for group roles** — RS and DCS see groups everywhere: Select Duty picks groups, Upcoming Duties shows one card per group, Change Requests swap whole groups, Dashboard aggregates by groups. The same partition key format (`scheduleId:buildingId:chunkIndex` for RS, persistent `DCSGroup._id` for DCS) is used across all four surfaces so a group looks identical wherever it appears.
- **Transactional group operations** — RS/DCS claim and group swap approvals use `withOptionalTransaction` so a partial write is impossible on replica-set deployments (and cleanly re-runnable on standalone Mongo).
- **Soft deletes with pre-hooks** — `Exam` and `User` are soft-deleted; Mongoose pre-hooks exclude them from find queries automatically.
- **Notification decoupling** — a central emitter pattern (`notification.emitter.js`) with typed templates lets any service emit without knowing about the notification schema.
- **Client-derived RS groups** — RS groups exist only as computed views over the same `AvailableDutySlot` list Select Duty consumes. This keeps the source of truth in one place; group swap requests snapshot the concrete IDs at submit time so the approval always has a stable target.

## Recent Enhancements

- **DCS supervision module** — persistent `DCSGroup` collection with per-schedule sizing (`ceil(students / 300)`), deterministic room distribution, claim/release lifecycle, per-group invigilator contact lookup, and `dcs_swap` change-request type. Generation is wired into `finalizeCIEPlan` / `finalizeSEEPlan`; a `backfill-dcs-groups.js` script backfills legacy `ExamGroup`s.
- **Building-aware conflict detection** across the entire duty stack (model, repository, service, `examGroup.getDutyStatus`, `changeRequest.isInvigilatorAlreadyAssigned`, invigilator frontend selection utilities).
- **RS group-based UI parity** — Upcoming Duties, Change Requests, and Dashboard now all render one card per RS group instead of per room. Backend gained `rs_group` scope and `rs_swap` type on `ChangeRequest` with atomic approval, and `Duty` gained an indexed `roomRef` field for building-scoped queries.
- **Elective seeding** — every `(department, semester)` pair has at least one professional-elective and one open-elective course, attached to `ElectiveGroup`s so the Departments UI renders them.
- **Reactivate soft-deleted teachers** — Teachers admin page opts into `GET /users?includeInactive=true`, sorts deactivated users to the bottom (dimmed row, amber "Not active" pill), and exposes a highlighted power toggle whose "on" state signals deactivation. Reactivation goes through the new `PATCH /users/:id/activate` endpoint (dedicated because the model's pre-find hook otherwise hides inactive users from `findByIdAndUpdate`).
- **CS-only change-request review** — `getReviewerIds` narrows `request_submitted` fan-out to active CS users (DCS is a duty role, not an admin role). Approve/reject notifications continue to reach the requester (and the swap counterparty for invigilator swaps).
- **Claim-duty confirmation gate** — every self-assign path (invigilator, RS, DCS) routes its submit button through a shared `ConfirmActionModal` (`shared/components/`), which sits on top of the shared `Modal` (portalled + propagation-safe) so no per-panel workaround is needed.
- **Sidebar-aware layout** — `MainContent` (`shared/components/`) reads `sidebarOpen` from the app store and toggles the main column's left margin, so collapsing the sidebar reclaims the horizontal space instead of leaving a gutter. All four role layouts (`ProtectedLayout`, `InvigilatorLayout`, `RSLayout`, `DCSLayout`) share it.
- **Role-labelled sidebar heading** — the sidebar's section header renders the active role from `ROLE_LABELS` (single source of truth) instead of a hardcoded "Navigation" string.

## Contributing

Follow the existing patterns:
- Add a new backend feature under `backend/modules/<domain>/` with `.controller.js`, `.service.js`, `.repository.js`, `.model.js`, `.routes.js`.
- Mount the route in `backend/app.js`.
- Add a matching frontend module under `frontend/src/modules/<domain>/` with `pages/`, `components/`, `hooks/`, `services/`, `types.ts`.
- Cross-role behavior goes under `frontend/src/modules/shared/`.
- Prefer using `roomRef` (ObjectId) over `room` (string) for any building-sensitive query.
- Emit notifications for user-visible state changes via `notification.emitter.js`.
