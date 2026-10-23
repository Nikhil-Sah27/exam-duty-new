# Mobile: change requests and messages inside the app

Status: **approved and in progress** (2026-10-23). The user's direction: "make it work like the website", for every role, with full messaging parity.

## What went wrong

The phone app never had its own change-request or messaging screens. Three buttons opened the
**website** in the phone's browser instead:

| Where | Opened |
|---|---|
| Home → "Change requests" (`mobile/src/app/(tabs)/index.tsx:128`) | `proctavo.com/<role>/change-requests` |
| Home → "Message the exam cell" (`index.tsx:136`) | `proctavo.com/<role>/messages` |
| Duty → "Request a change on the website" (`mobile/src/app/duty/[key].tsx:99`) | `proctavo.com/<role>/change-requests` |

The browser keeps its own login, separate from the app's. On a phone where someone had signed
in to proctavo.com as CS, an invigilator tapping these landed in the **CS account**. That is an
identity problem, not a layout bug: actions taken there were CS actions.

## Backend authorization: fixed (2026-10-23)

A sweep of every route found that many writes only checked "logged in", not "is CS". The website
hid the buttons, but any teacher could call the API directly. All of these are fixed and tested:
`tests/18-authorization.test.js` plus 3 new tests in `08-change-requests`, with the full suite at
177/177.

| What a teacher could do | Now |
|---|---|
| Create, edit or delete exam groups, schedules and exam rooms. Deleting cancels everyone's duties. | CS-only |
| Run CIE/SEE exam creation (plan, assign rooms, finalize) | CS-only |
| Create, edit, cancel or restore exams | CS-only |
| Edit departments, semesters, electives and courses (student counts drive duty targets) | CS-only |
| Create or delete buildings and rooms, change room capacity | CS-only |
| Mark seats shareable, release seat allocations | CS-only |
| Read the full staff directory with phone numbers (`GET /users`, `/users/:id`) | CS-only |
| Read any teacher's workload and target (`/duty-calculation/teacher/:id/*`, `/all-teachers`) | CS-only |
| List every duty in the college (`GET /duties`, `/duties/:id`) | Teachers get only their own |
| List and read every change request with reasons | CS-only list; detail for CS and the people involved |
| Cancel one room of an RS/DCS group, leaving the group broken | Refused; release or swap the whole group |

Teacher reads still work (exams, departments, buildings, own progress, own duties); this is tested.

**Not fixed yet (follow-ups):**
- Self-claim checks: `/duties/self-assign-group` accepts any room set for RS (no check that it is one
  derived ≤5-room chunk), and for DCS it skips the `DCSGroup` claim. `/duties/self-assign` also
  accepts `rs`/`dcs`. A teacher can claim more than the UI offers, but can't see or change other
  people's data. This needs care so the real Select Duty flows keep working.
- Push device registration is keyed on the Expo token alone. Low risk: tokens are never exposed.
- Known and accepted: duty-status and DCS group endpoints return holders' names and phones to all
  teachers. Only the UI hides them ("Only CS sees who holds a duty" in CLAUDE.md). Worth closing in
  the API later.

## Plan

Everything below runs in the app with the app's own token. Nothing opens the website.

### Phase 1: Messages (smallest, fixes one of the three hand-offs)

- New screen `src/app/messages.tsx`, opened from Home. It shows the teacher's single thread with
  CS: `GET /api/messages/thread`, sending with `POST /api/messages/thread`.
- Unread count on the Home row: `GET /api/messages/thread/unread`.
- Refresh when the screen opens, and every ~10 s while it's open. Messages don't trigger push
  today, so polling is the only live signal.
- Code lives in `src/features/messages/{api,hooks}.ts`, matching `features/duties`.

### Phase 2: Change requests

- **My requests** screen: `GET /api/change-requests/mine`, with pending / approved / rejected and
  CS's note.
- **Request a change** from the duty screen, with the same options the website gives each role:
  - Invigilator: **move** to another open slot. Picker from
    `GET /api/change-requests/replacements/:dutyId`, plus a reason. This reuses the website's
    rules (`canRequestChange`, `canSelectReplacement` in
    `frontend/src/modules/shared/change-requests/utils/changeRequestValidation.ts`), ported.
  - RS: **swap group** (`rs_swap`). Groups must be derived the same way as everywhere else
    (`groupRoomsIntoRSGroups`, CLAUDE.md invariant).
  - DCS: **swap group** (`dcs_swap`).
- One pending request per duty. The backend already enforces this, and the screen shows it.

### Phase 3: Remove the hand-offs

- Delete the "On the website" card and the duty-screen website button.
- Keep `cs-web.tsx`: a CS who signs in to the app is deliberately sent to their own website,
  which is correct.

### Checks

`npx tsc --noEmit && npx expo lint` in `mobile/`. Each flow is run on the OnePlus against a local
backend with test accounts (invigilator / RS / DCS), never production.

## Decisions (2026-10-23)

1. All three roles' change requests in one go, matching the website.
2. Messages: full website parity (edit, delete, reactions included).
3. The website hand-offs are removed once the in-app screens are in. The app has only been
   installed on the user's own phone, so no teacher was exposed.
