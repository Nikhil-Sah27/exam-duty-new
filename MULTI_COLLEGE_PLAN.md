# Multi-college Proctavo — plan

Status: **built 2026-10-08**. All three phases shipped together; decisions are in §5.

Proof:
- `tests/17-colleges.test.js` — 20 isolation tests;
- the full suite, 167/167;
- a rehearsal of the boot migration on `db-dump.json`, where every count matched;
- a browser run of superadmin → new college → its CS.

Production was backed up first to `~/backups/pre-multicollege-20261008-0023.json` on the server.

## 1. What was asked

- A **superadmin** above CS who manages the platform.
- The superadmin creates **colleges**, and inside each college creates its **CS (admin) accounts**.
  Those CS log in at the same proctavo.com and land in *their own* college; they add their
  teachers (Add Teacher / CSV import) exactly as today.
- **Every college is isolated** — its teachers, departments, rooms, exams, duties, messages,
  notifications and reports are invisible to every other college.
- **Feature switches per college**, starting with exam types: CIE on/off and SEE on/off
  (both, either, or neither), with room for more switches later.

## 2. What exists today

- One college per deployment. CS is the top role; there is no concept of "college" anywhere.
- 27 collections. All of them except the mail/push outboxes and device tokens hold one
  college's data.
- Some names are unique across the whole database — department name/code and building name —
  so two colleges couldn't both have "CSE" or "Block A".
- Background work is global: the reminder tick (5 min), the 6-hourly sweeps, calendar sync,
  and the mail/push dispatchers all scan everything.
  - "Tell CS" lookups (`userService.getCsUserIds`, change-request reviewers) would reach every
    college's CS.
- The live-update socket broadcasts `duties:changed` to every signed-in browser.
- Exam types are `IA1/IA2/IA3` (= **CIE**) and `SEE`. Create Exams already starts with a
  CIE-or-SEE picker (`ExamTypeSelector`), so the feature switches have a natural home.
- `POST /users/bootstrap` is unauthenticated and creates the first CS when no CS exists.

## 3. Design

### 3.1 Who is who

```
Superadmin (platform, belongs to no college)
 └─ College A  — features {cie, see}, status active/suspended
     ├─ CS accounts (created by superadmin, or by another CS of A)
     └─ teachers: invigilator / RS / DCS (created by A's CS — Add Teacher, CSV import)
 └─ College B  — …
```

- **One login page.** Email decides the college: emails stay unique across the platform, so a
  login always maps to exactly one college. (A person working at two colleges uses two
  emails.) The mobile app needs no change.
- The college is read from the **user record** on every request (`protect` already loads the
  user), never from anything the browser sends. A CS of college A cannot ask for college B's
  data, even by guessing ids.
- **Suspending a college** blocks every login in it immediately (existing tokens included)
  without deleting anything.

### 3.2 Isolation — one database, fenced automatically

Every college-owned document gets a `college` field. A Mongoose plugin, attached to all
college-owned models, reads "the current college" from request context (`AsyncLocalStorage`,
set by `protect`). It works like the soft-delete pre-find hooks that already exist:

- **reads** (`find`, `findOne`, `count`, `distinct`, `aggregate`, updates, deletes) get
  `college = <current>` added automatically;
- **writes** (`save`, `create`, `insertMany`) get the field stamped automatically.

**Fail-closed:** a query on a college-owned model with *no* college in context **throws**
instead of returning everything. Only code that is deliberately platform-wide opts out:

- the login lookup;
- the mail/push dispatchers, which work off outbox rows that already name one recipient;
- the superadmin screens.

So a forgotten spot breaks loudly in tests instead of leaking quietly in production.

Knock-on changes:

- **Unique names become per-college:**
  - Department name/code and building name are scoped to the college.
  - User email stays global (see 3.1).
  - Id-based unique indexes (rooms in a building, duty slots, etc.) are already safe.
- **Background jobs** loop over active colleges and run each college's sweep inside that
  college's context. That covers reminders, confirm nudges, select-your-duty nudges, target
  sweeps and calendar sync.
  - Batched timers carry the college per item. The calendar-sync debounce and the realtime
    coalescer both batch work from many requests into one timer, so they mustn't inherit
    one college's context for everyone.
- **Live updates:** each browser joins a socket room for its college, and `duties:changed`
  goes only to that room.
- **Audit log:** scoped per college. A CS sees only their college's trail.

### 3.3 Superadmin

- New role `superadmin`, outside the college roles (`roleResolver` never derives it). It is
  created **only from the server**: `node scripts/create-superadmin.js <email>`. No public
  endpoint.
- `POST /users/bootstrap` (unauthenticated) is **removed**. New colleges get their first CS
  from the superadmin.
- New backend module `modules/platform/` (`/api/platform/*`, `requireRole("superadmin")`):
  - **colleges:** list, create, rename, suspend/reactivate;
  - **feature switches;**
  - **CS accounts per college:** add, deactivate, reset password;
  - **per-college counts:** teachers, exams, upcoming duties.
- New frontend shell for superadmin (its own sidebar, like the RS/DCS shells):
  - **Colleges** page: a table with name, code, status, CIE/SEE toggles and counts.
  - **New college** form: the college plus its first CS in one step.
  - **College detail** page: features, CS accounts, suspend.

### 3.4 Feature switches

`College.features = { cie: true, see: true }` — both on by default, so nothing changes for
existing users. Effects of turning one **off**:

- **Create Exams** only offers the enabled types. If only one is on, the picker is skipped.
  If both are off, the page says exam creation is turned off for this college.
- **API** refuses to create an exam group of a disabled type (403), so this isn't UI-only.
- **Existing exams of that type are hidden**, together with their duties, reminders, alarms
  and invites (Q2). Switching the type back on restores them.
- The current college's features ride along with the logged-in user (`/auth/me`), so every
  page can check `features.cie` / `features.see` without extra calls.

Built as a small registry (`features.js`: key, label, default), so later switches are one
entry plus their checks. Possible later switches: messages, mobile alerts, email
notifications, calendar invites.

### 3.5 Moving production onto this (no downtime, no manual step)

On first boot of the new code, an idempotent migration runs:

1. If no college exists, it creates one ("Main college", renamable by the superadmin).
2. It stamps that college on every existing record that has no `college` yet.
3. It swaps the old global unique indexes (department name/code, building name) for
   per-college ones.

Every existing login, exam and duty keeps working unchanged. A database dump is taken first
(`scripts/dump-database.js` on the server — I'll give the one-line command, since prod
`.env` access stays with you).

## 4. Build order

Each phase is shippable on its own; everything deploys at turn end (auto-push → webhook).

| Phase | What | Visible change on proctavo.com |
| --- | --- | --- |
| **1. Isolation foundation** | `College` model, request context, fail-closed plugin on all college-owned models, per-college unique indexes, jobs per college, socket rooms, boot migration, isolation test suite | None — prod becomes "Main college"; everything works as before |
| **2. Superadmin** | role + `create-superadmin` script, remove bootstrap, platform API, Colleges screens, suspend | You can log in as superadmin and create a second college with its own CS |
| **3. Feature switches** | registry, CIE/SEE toggles in the superadmin UI, API enforcement, Create Exams + listings respect them | Turning off CIE/SEE for a college takes effect immediately |

**Proof** — new `tests/17-colleges.test.js`. It builds two colleges with the same department
and building names and checks that:

- college B's CS gets nothing from college A: list, get-by-id, update-by-id, delete-by-id,
  duty-status, messages, notifications, reports and audit;
- B's teachers can't claim A's duties;
- reminders and "tell CS" alerts only reach the right college;
- a suspended college can't log in;
- a disabled exam type can't be created.

The existing 147 tests must keep passing unchanged (they run inside the migrated
"Main college").

## 5. Decisions (2026-10-08)

- **Q1 — Levels: colleges only.** Superadmin → colleges → CS → teachers. Each college has its
  own switches. An organisation grouping can be added later by putting an `organisation` field
  on College, with no data move.
- **Q2 — Turning a type off: hide completely.** Exams of a disabled type disappear from every
  page in that college, and so do their duties. That covers:
  - lists, Select Duty, upcoming duties, counts and targets;
  - reminders and phone alarms;
  - calendar invites, which get cancelled.

  Nothing is deleted: switching the type back on brings everything back, and invites are
  re-sent. New exams of a disabled type can't be created.
- **Q3 — Superadmin's view: manage only.** Superadmin sees colleges, CS accounts, switches and
  counts, never teachers' names, exams or duties.

Defaults kept:

- one login page, email decides the college;
- both features on by default;
- the existing data becomes "Main college", renamable;
- superadmin only via a server script.

## 6. Not in this plan (later, if wanted)

- A subdomain per college (`rvce.proctavo.com`).
- A different email sender per college.
- Billing and plans.
- More feature switches.
- A college admin managing several colleges.
