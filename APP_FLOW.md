# Exam Duty — Application Flow

Deep, role-by-role walkthrough of the app in action. Complements the [README](README.md) — the README lists features and endpoints; this document narrates how a user actually uses the system, screen by screen.

Every login lands on `/login`. `AuthGuard` (`frontend/src/shared/components/AuthGuard.tsx`) reads `localStorage["token"]`, calls `GET /api/auth/me`, and — depending on `user.role` — either mounts the CS admin shell or redirects to `/invigilator/dashboard`, `/rs/dashboard`, or `/dcs/dashboard`.

Test logins: see [CREDENTIALS.md](CREDENTIALS.md).

---

## 1. CS — Controller of Superintendents

CS has full system access. On login, the admin shell (`ProtectedLayout`) mounts the left sidebar with every management page.

### 1.1 First-time setup
1. The platform superadmin (created on the server with `node backend/scripts/create-superadmin.js <email>`) signs in, lands on `/platform`, and creates the college together with its first CS. Feature switches (CIE / SEE exams) are set per college there too.
2. Log in.
3. Add other faculty via **Users** → assign roles (`cs` / `dcs` / `rs` / `invigilator`) and departments.

### 1.2 Set up academic structure
1. **Departments** — create departments, then per-department semesters, then courses under each semester. Course type is one of `core`, `professional_elective`, `open_elective`; electives can be organized into `ElectiveGroup`s so the UI renders them grouped.
2. **Infrastructure** — add buildings; add rooms per building (single or bulk range). Each room carries floor + capacity; `(building, roomNumber)` is unique.

### 1.3 Create exams — the wizard
Route: `/create-exams`.

Two workflows: **CIE** (IA1/IA2/IA3) and **SEE** (semester end). Both share the same shape:

1. **Config** — pick exam type, semester, and departments (multi-select).
2. **Routine** — start date + per-day shift times. The `POST /api/create-exams/cie/calculate-dates` (or `see/calculate-dates`) endpoint auto-generates the calendar of exam dates given the number of courses and shifts.
3. **Room assignment** — per-schedule allocation. The picker groups available rooms by building, warns when a room is already taken in an overlapping schedule (building-aware), and offers "Use Shared Seats" for rooms with a matching `RoomSharingConfiguration`.
4. **Seat sharing** — for rooms that overlap with an already-shareable schedule, the wizard offers a modal to allocate seats from the source pool. The `remainingSeats` counter uses a `$gte` atomic guard, so two concurrent finalizes can't over-allocate.
5. **Finalize** — one call to `POST /api/create-exams/cie/finalize` (or `see/finalize`). Inside a single transaction:
   - `ExamGroup` created (type + semester + date range).
   - `ExamSchedule` per exam date.
   - `ExamRoom` per (schedule, room) pair, with per-department seat metadata.
   - `DCSGroup` per schedule — sized by `ceil(totalStudents / 300)`; rooms distributed with `floor(rooms / N)` per group + a remainder spread to earlier groups; sorted numerically.
   - `RoomSharingConfiguration` for any room the CS marked shareable during allocation.
   - `SharedSeatAllocation` for consumer rooms borrowing from a source pool.

### 1.4 Manage duties
Route: `/manage-duties`.

Per-teacher panel showing active/completed/total counts, filters (search + department + role). Clicking a teacher opens the assignment modal to force-assign them to any open slot (`POST /api/duties/admin-assign`).

### 1.5 Review change requests
Route: `/requests` (or `/change-requests`).

Tabs: **Pending**, **Approved**, **Rejected**. The shared `ChangeRequestCard` renders all three scopes:

- **Duty scope** (`swap`/`drop`/`move`) — invigilator-raised. Move requests show a source → target duty block.
- **DCS group scope** (`dcs_swap`) — source and target `DCSGroup`s side by side with room chips.
- **RS group scope** (`rs_swap`) — source duty snapshot and target `ExamRoom` snapshot side by side; both rendered as group blocks with a `Rooms X–Y` range label.

Approve calls `PATCH /api/change-requests/:id/approve`; the service routes internally by `scope`:
- `duty` → `swap`/`drop`/`move` handled inline in `approveRequest`.
- `dcs_group` → `approveDcsGroupSwap` — cancels source duties, creates target duties, transfers ownership.
- `rs_group` → `approveRsGroupSwap` — cancels the snapshotted source duties, creates one duty per snapshotted target `ExamRoom`, all inside a transaction.

### 1.6 Delete an exam
Deleting an `ExamGroup`, `ExamSchedule`, or `ExamRoom` triggers `backend/modules/exam-cleanup/services/examDeletionService.js`. In a single transaction it:
1. Cancels every dependent `Duty` (`status = cancelled`).
2. Marks open `ChangeRequest`s as `cancelled_exam_deleted`.
3. Releases `SharedSeatAllocation`s and restores the source pool's `remainingSeats`.
4. Emits `exam_deleted_duty_release` notifications to every affected teacher.

---

## 2. DCS — Deputy Controller of Superintendents

Route base: `/dcs`. Grain: **a whole DCSGroup** (persistent, one DCS per ~300 students).

### 2.1 Dashboard
Hero band with:
- Upcoming groups count.
- Total rooms under supervision (summed across upcoming groups).
- Total students.

Below: sections for **Upcoming Duties** (list of claimed groups, one card each with room chips + student count) and **Completed Duties**. Data fetched via `getMyDcsGroups()` (`GET /api/dcs/groups/mine`) and normalized with `normalizeDcsUpcoming/Completed`.

### 2.2 Select Duty
Route: `/dcs/select-duty`.

Lists all `DCSGroup`s with status `open`. Each card shows:
- Exam type + semester.
- Schedule date and time.
- All rooms in the group with per-room capacity and department chips.
- Total students and DCS required.
- Time-conflict warning if the group clashes with any of the DCS's other assigned duties.

Clicking **Claim** → `POST /api/dcs/groups/:id/claim`. In a transaction: creates one `Duty` per room in `assignedRooms`, sets `roomRef` from `examRoom.room._id`, updates the group to `status = claimed` with `assignedTeacher = <you>` and `duties = <ids>`.

### 2.3 Upcoming Duties
Route: `/dcs/upcoming-duties`.

One card per claimed group, grouped by date. Each card lists every room in the group with the assigned invigilator's name and contact (fetched via `GET /api/dcs/groups/:id/invigilators`), so the DCS knows who to coordinate with on the day.

### 2.4 Change Requests
Route: `/dcs/change-requests`.

Shows owned groups with a **Request Change** button. Clicking opens the `DcsSwapTargetModal` listing every `open` DCS group that:
- Isn't the current group.
- Doesn't time-clash with the DCS's other duties.

Submitting posts `POST /api/change-requests` with `type = dcs_swap`, `dcsSourceGroup`, `dcsTargetGroup`, reason. A unique index on `(dcsSourceGroup, requestedBy, status: pending, scope: dcs_group)` prevents queuing two swaps for the same source group.

Approval by CS moves every duty from source to target atomically and transfers group ownership.

### 2.5 Approving other requests
DCS is treated as an admin role by `getAdminIds()` in `changeRequest.service.js`. If the sidebar is configured to expose the shared admin change-request page, a DCS user can also approve/reject requests raised by others.

---

## 3. RS — Room Superintendent

Route base: `/rs`. Grain: **a group of ≤5 rooms** partitioned by `(examGroup, schedule, date, startTime, endTime, buildingId)` and sorted numerically. Unlike DCS, RS groups are **client-derived** — there is no `RSGroup` document; the deterministic `groupId = ${scheduleId}:${buildingId}:${chunkIndex}` identifies each group.

The same grouping algorithm (`groupRoomsIntoRSGroups` in `rs/select-duty/utils/rsDutyGroupingUtils.ts`, and `groupRSDutiesIntoUpcomingGroups` in `rs/upcoming-duties/utils/rsUpcomingGrouping.ts`) is used across four surfaces so the RS sees identical groups everywhere.

### 3.1 Dashboard
Hero band with:
- **Groups** — number of upcoming groups.
- **Rooms** — total rooms across those groups.
- **Buildings** — distinct buildings.

Sections: **Upcoming Duties** and **Completed Duties**, one card per group (never per room). Data comes from `useDutiesByTeacher` → `normalizeRsGroupsUpcoming/Completed`.

### 3.2 Select Duty
Route: `/rs/select-duty`.

Grid or table view. Each tile is one RS group: `Academic Block — Rooms 001–005`, with per-room chips underneath. Group states:
- **Available** — no room in the chunk has an RS assigned yet.
- **Selected** — currently in the RS's selection list.
- **Full** — every room in the chunk already has an RS.
- **Conflict** — group's time overlaps with another selection or existing duty (with the reason surfaced in the tile).

Submitting `POST /api/duties/self-assign-group` with the group's `examRoom` IDs creates one duty per room atomically (`selfAssignDutyGroup` in `duty.service.js`).

### 3.3 Upcoming Duties
Route: `/rs/upcoming-duties`.

Layout: date sections → time-slot subsections → grid of group cards. Each card shows the building + range label, per-room chips, exam type + semester chip, and department chips.

Clicking a card opens `RSUpcomingGroupModal` with the full room roster (floor + capacity per room) and read-only instructions.

### 3.4 Change Requests
Route: `/rs/change-requests`.

Each owned group is a card with a **Request Change** button. Clicking opens `RsSwapTargetModal`, which reuses `useAvailableDutySlots` (same pipeline as Select Duty) and lists every RS group that:
- Isn't the source.
- Has no room already RS-assigned.
- Doesn't time-clash with any of the RS's *other* duties (self-clash is excluded — moving off source frees those rooms).

Submitting posts `POST /api/change-requests` with:
- `type: "rs_swap"`
- `rsSourceDuties`: the source group's duty IDs
- `rsTargetExamRooms`: the target group's `ExamRoom` IDs
- `rsSourceKey` / `rsTargetKey`: the deterministic group ids

A unique index on `(rsSourceKey, requestedBy, status: pending, scope: rs_group)` prevents duplicate swaps.

Approval (`approveRsGroupSwap`) cancels every source duty and creates one new duty per target `ExamRoom`, all with `roomRef` populated for building-aware conflict scanning.

---

## 4. Invigilator — Faculty

Route base: `/invigilator`. Grain: **one room per time slot**.

### 4.1 Dashboard
Hero band + upcoming/completed sections. One card per duty (per room), grouped by date and time slot.

### 4.2 Exams
Route: `/invigilator/exams` and `/invigilator/exams/:id`.

- List view: all upcoming/ongoing exam groups the invigilator can pick from.
- Detail view: per-schedule timetable with a coloured pill per room:
  - **Available** — open for selection.
  - **My duty** — assigned to this invigilator (matched by `examRoom.room._id`, not by room number, so cross-building numbers never collide).
  - **Occupied** — another invigilator has this slot.
  - **Time conflict** — an existing assignment of the invigilator overlaps this slot.

### 4.3 Select Duty
Route: `/invigilator/select-duty`.

Grid (default) or table. Available slots only — filtered through `dutySelectionUtils.ts`:

- `isDutyAvailable(slot, myDuties, "invigilatorAssigned")`:
  - Not pending.
  - Role-specific slot not filled (`flags.invigilatorAssigned`).
  - Invigilator hasn't already claimed the same room+time (matched by `examRoom.room._id`).
  - No time overlap with any of the invigilator's other assigned duties.

Selecting a slot and confirming posts `POST /api/duties/self-assign` with `examScheduleId` + `examRoomId`. The service validates lifecycle (past schedules rejected), runs the conflict scan, and creates the `Duty` with `roomRef` set from the resolved `examRoom.room._id`.

### 4.4 Upcoming Duties
Route: `/invigilator/upcoming-duties`.

One card per assigned duty. Cards show exam type + semester chip, invigilator chip, time, date, and `Building — Room` label. Clicking opens `UpcomingDutyModal` with the paper/course summary (scoped to the room's department), reporting time (15 min before start by default), and detailed room info.

### 4.5 Change Requests
Route: `/invigilator/change-requests`.

Three request types:

1. **Swap** — pick a partner teacher; on approval, the partner takes over the duty.
2. **Drop** — with reason; on approval, the duty is cancelled.
3. **Move** — the modal fetches replacements via `GET /api/change-requests/replacements/:dutyId`. Only slots that are:
   - Not the current slot.
   - Not in the past.
   - Not already invigilator-assigned (building-aware via `roomRef`).
   - Not time-clashing with the invigilator's other assigned duties.

On approval, the old duty is cancelled and a new duty is created on the target schedule + examRoom with `roomRef` set from `requestedExamRoom.room._id`.

---

## 5. Cross-Cutting Systems

### 5.1 Conflict Detection

`backend/modules/duty/duty.repository.js:findRoomConflict` scopes by:
- `roomRef` when the caller provides one — building-aware.
- Legacy `room` string as a fallback for old duties predating the `roomRef` field.
- The caller's `role` so DCS/RS/Invigilator slots on the same room are independent (a room can host all three at once).

The equivalent frontend logic lives in:
- `frontend/src/modules/invigilator/duties/utils/dutySelectionUtils.ts` — `dutyMatchesSlot(duty, slot)` prefers `examRoom.room._id === slot.roomId`.
- `frontend/src/modules/shared/exams/utils/examStatusUtils.ts` — same helper for the shared exam views.

### 5.2 Notifications

Emitted via `backend/modules/notification/notification.emitter.js`:

| Type | Fires when |
| --- | --- |
| `duty_assigned` | Admin assigns a teacher to a slot. |
| `duty_cancelled` | Any duty is cancelled. |
| `request_submitted` | A change request lands — recipients are all CS + DCS. |
| `request_approved` / `request_rejected` | CS/DCS reviews a request. |
| `duty_swapped` | Approved `swap` request — target teacher gets a heads-up. |
| `exam_deleted_duty_release` | Cascade delete releases the teacher's duty. |

Notifications reference either a `Duty` or a `ChangeRequest`, so the UI bell can deep-link to the record.

### 5.3 Seat Sharing

`backend/modules/seat-sharing/`:
- `RoomSharingConfiguration` — one per shareable `ExamRoom`. Tracks `initialShareableSeats`, `remainingSeats`, source metadata.
- `SharedSeatAllocation` — one per consumer group borrowing seats.

Discovery: `POST /api/seat-sharing/available` finds overlapping shareable rooms.

Allocation happens inside the exam finalize flow. Each allocation decrements `remainingSeats` with `{ $gte: <need> }` — atomic under concurrent finalizes.

Release: deleting an `ExamRoom` or an allocation restores `remainingSeats`.

### 5.4 Auth

`shared/middleware/auth.js` implements `protect` — reads `Authorization: Bearer <token>`, verifies via `JWT_SECRET`, looks up the user, and attaches to `req.user`. Routes mount `protect` explicitly at the route file level. There is no per-endpoint role gate in middleware today; role-sensitive logic (e.g. "only the group owner can swap") lives in the service layer.

Frontend `useAuthStore` persists the token to `localStorage`; the Axios instance in `frontend/src/shared/lib/api.ts` attaches the header automatically and logs out on 401.

### 5.5 Data Freshness

Every screen that mutates duties (Select Duty, Change Requests, Manage Duties) uses TanStack React Query. Mutations invalidate a canonical set of keys via `invalidateAll` in `frontend/src/modules/shared/change-requests/hooks/useChangeRequests.ts`:
- `change-requests` (all lists)
- `shared/duty-status` (per-exam-group flags used by the exam detail views)
- `shared/duties-by-teacher` (the source of truth for Dashboard + Upcoming Duties + Change Requests + RS group derivation)
- `dcs` (DCS group lists)

So an approved swap immediately refreshes every affected surface without extra plumbing.
