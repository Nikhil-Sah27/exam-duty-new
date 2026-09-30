# Notifications + Email + Messaging — Implementation Plan

**Status:** approved 2026-09-30 — Phases 1 & 2 in progress.

**Decisions taken:**
- **Sender:** deferred. The mail layer ships with `MAIL_TRANSPORT=console` (renders and logs, sends nothing);
  plugging in Gmail App Password / Workspace / a provider later is env-only, no code change.
- **Chat scope:** teacher ↔ CS only. Not being built in this pass (Phase 4).
- **Build scope:** Phases 1 & 2 — email delivery plus the six missing notifications. Phases 3–5 deferred,
  which means `exam_created` stays in-app only for now (its digest is Phase 5) and there is no per-user
  preferences UI yet, though the policy layer already checks for one.

Three separate pieces of work, in dependency order:

1. **Email delivery** — every notification the app already sends also goes out as email.
2. **Notification gaps** — events that change a teacher's duties but currently notify nobody.
3. **Messaging** — a teacher ↔ CS conversation thread, in-app.

---

## 1. Where things stand today

The in-app notification system is already well-built, and that is what makes email cheap to add.

**`backend/modules/notification/notification.emitter.js` is the single choke point.** Every notification in
the app is created through one of its four functions — `emit`, `emitToMany`, `bulkEmit`, `emitIfAbsent` —
and nothing writes `Notification` documents directly. There are 15 call sites across `duty`, `dcs`,
`change-request`, `create-exams`, `exam-cleanup`, and `notify`.

That means **email hooks into exactly one file**, and every notification type — including ones added later —
gets email without touching its call site. This is the key reason the plan is small.

What exists:

| Piece | File | Notes |
| --- | --- | --- |
| Emitter (4 entry points) | `notification.emitter.js` | the hook point for email |
| 12 typed templates | `notification.templates.js` | title + message per type |
| Model with dedupe index | `notification.model.js` | partial unique index on `dedupeKey` |
| Time-based sweeps | `notification.jobs.js` | `duty_reminder`, `target_reached` |
| In-process scheduler | `notification.scheduler.js` | 6-hour interval, idempotent |
| CS broadcast | `modules/notify/` | `POST /api/notify`, fan-out via `emitToMany` |
| Bell UI + 30s poll | `Navbar.tsx`, `modules/notifications/` | unread count polls every 30s |

What does **not** exist: any email capability at all. No mail dependency, no SMTP config, no
`User.email` usage beyond login.

---

## 2. Notification inventory — current, gaps, and email policy

### 2.1 Notifications that exist today

| Type | Fires when | Goes to | Email? |
| --- | --- | --- | --- |
| `duty_assigned` | CS assigns a single room duty | the teacher | **Yes** |
| `duty_group_assigned` | CS/self assigns an RS or DCS group | the teacher | **Yes** |
| `duty_cancelled` | a duty is cancelled | the teacher | **Yes** |
| `exam_deleted_duty_release` | exam deleted, duty auto-released | each affected teacher | **Yes** |
| `request_submitted` | teacher files a drop/swap request | all CS reviewers | **Yes** |
| `request_approved` | CS approves a request | the requester | **Yes** |
| `request_rejected` | CS rejects a request | the requester | **Yes** |
| `duty_swapped` | a swap lands a new duty on someone | the receiving teacher | **Yes** |
| `duty_reminder` | daily sweep, duty tomorrow | the teacher | **Yes** |
| `target_reached` | daily sweep, target completed | the teacher | In-app only |
| `exam_created` | CS publishes an exam | *every eligible teacher* | **Batched** — see §3.4 |
| `announcement` | CS broadcast via Notify | chosen audience | **Opt-in per broadcast** |

### 2.2 Gaps — real events that notify nobody today

These are things that already happen in the app and silently change what a teacher is committed to.
Each is a small addition to the templates file plus one emit call.

| New type | Fires when | Goes to | Why it matters |
| --- | --- | --- | --- |
| `duty_self_claimed` | **a teacher selects a duty** | the teacher | **Your example.** `duty.service.js:227` guards with `if (!isSelfAssigned)`, so self-claim is completely silent right now — no bell entry, nothing to email. |
| `duty_claimed_by_teacher` | a teacher self-claims | CS | CS has no feed of self-claims; today they only see it by opening Manage Duties. |
| `duty_released_by_teacher` | a teacher drops a duty | CS | Same blind spot in the other direction — a room silently goes vacant. |
| `exam_updated` | exam date / time / room set changes | every teacher holding a duty on it | Biggest correctness gap: a schedule change today leaves teachers acting on stale information with no signal. |
| `group_released` | an RS/DCS group is released | CS | A whole group of rooms goes vacant unannounced. |
| `message_received` | new chat message (§4) | the other participant | Drives the chat unread badge. |

I would build §2.2 as part of this work, not later — `duty_self_claimed` in particular, because it *is* the
example you gave, and it does not exist.

---

## 3. Email delivery

### 3.1 New module: `backend/modules/mail/`

Service-only, no routes (same shape as the existing `exam-cleanup` module):

```
backend/modules/mail/
  mail.transport.js     # nodemailer transport, built from env
  mail.service.js       # sendMail() — retries, never throws into callers
  mail.templates.js     # branded HTML layout + per-type bodies
  mail.dispatcher.js    # drains the outbox, marks sent/failed
  emailOutbox.model.js  # queue + delivery audit trail
```

One new dependency: `nodemailer`.

### 3.2 How it hooks in — the transactional outbox

The naive version (call `sendMail` inside `emit`) breaks in two ways this codebase will actually hit:

- **`emit` is frequently called inside a transaction** (`withOptionalTransaction` wraps group claims,
  swap approvals, admin-assign-group). If the transaction rolls back after the email is out, a teacher has
  an email about a duty that does not exist.
- **SMTP is slow and fails.** Awaiting it inside a request makes duty assignment slow and makes a Gmail
  outage look like a duty-assignment bug.

So: `emit` writes an **`EmailOutbox` row in the same transaction as the notification**, and a dispatcher
drains it out-of-band.

```
service (e.g. duty.service)
   └─ emit("duty_assigned", { recipient, data, session })
        ├─ Notification doc        ← same transaction
        └─ EmailOutbox row         ← same transaction, status: "pending"
                                      (skipped if policy or prefs say no email)

mail.dispatcher (every 30s, + kicked immediately after commit)
   └─ claim pending rows → render template → SMTP send
        ├─ ok    → status: "sent", messageId, sentAt
        └─ fail  → attempts++, retry with backoff, status: "failed" after N
```

Properties this buys us:

- Rollback safety — an aborted transaction takes its queued emails with it.
- Nothing user-facing ever blocks on or fails because of SMTP.
- Retries and a **delivery audit trail** — which matters for "did the teacher actually get told", which is
  the whole point in an exam-duty context.
- Survives restarts, including nodemon.

`emitIfAbsent`'s existing `dedupeKey` extends naturally to the outbox, so the 6-hourly sweeps can never
double-email a reminder.

### 3.3 Gmail specifically

Two workable routes, same code behind the same interface:

| Option | Setup | Daily cap | Fit |
| --- | --- | --- | --- |
| **Gmail SMTP + App Password** | 2FA on the account, generate an App Password, 4 env vars | ~500 recipients/day (consumer), ~2,000 (Workspace) | Fine to start; simplest |
| **Transactional provider** (Resend / SendGrid / SES) | API key, verify the sending domain | 10k+/day, better deliverability | Right answer if broadcasts go to all staff |

**The cap is a real constraint, not a footnote.** One `exam_created` broadcast fans out to *every* eligible
teacher — on a 300-teacher institution, a single exam publish is 300 emails and over half the consumer
daily quota. Mitigations in §3.4. Because it is one interface, starting on Gmail and switching later is an
env change, not a rewrite.

Env (`backend/.env`):

```env
MAIL_ENABLED=true
MAIL_TRANSPORT=gmail          # gmail | smtp | console
MAIL_USER=proctavo@gmail.com
MAIL_PASS=<16-char app password>
MAIL_FROM="Proctavo <proctavo@gmail.com>"
APP_URL=https://proctavo.com  # for deep links in emails
```

`MAIL_TRANSPORT=console` prints instead of sending — the default for local dev, tests, and CI. **The API
test suite must never send real email**, and seeded accounts (`@examduty.com`) are not deliverable
addresses, so they would bounce and hurt the sender reputation.

### 3.4 Volume control

- **Per-type policy table** in one file — each notification type declares `email: true | false | "digest"`.
  The table in §2.1 is the starting configuration; it is one object to edit, not scattered logic.
- **`exam_created` is digested**, not blasted: one "new exams open for selection" email per teacher per
  day, listing everything published that day.
- **`announcement`** gets an "also send email" checkbox in the existing Notify composer — CS decides per
  broadcast, so routine notices stay in-app.
- **`message_received`** emails only if the message is still unread after ~10 minutes, so a back-and-forth
  chat doesn't become 20 emails.
- **Per-user preferences** — `User.notificationPrefs`, with a Settings page: master email toggle plus
  per-category switches (duty changes / reminders / announcements / messages). Duty assignment and
  cancellation stay non-optional: they are operational, not marketing.

### 3.5 Email look

A shared branded HTML layout (Proctavo header, the duty details as a labelled table, a button deep-linking
to the relevant page, plain-text fallback). Duty emails carry what a teacher needs without logging in:
exam, semester, date, time, building + room, role. Templates live next to the in-app ones so wording stays
in step.

---

## 4. Messaging — teacher ↔ CS

### 4.1 Scope

Teachers converse with **the Controller's office**, not with each other. That keeps it genuinely simple for
both sides, avoids any moderation surface, and matches how duty questions actually escalate. DCS and RS are
teachers here. (Teacher-to-teacher is buildable later on the same models if you want it — worth deciding
now, see the questions at the end.)

### 4.2 Backend: `backend/modules/message/`

Standard module shape (`routes → controller → service → repository → model`):

- **`Conversation`** — participants, `lastMessageAt`, last-message snippet, per-participant unread counts,
  optional `subject`, optional `contextRef` (a duty or exam) so "message CS about this duty" carries its
  context.
- **`Message`** — conversation, sender, body, `readAt`, timestamps. Indexed on `(conversation, createdAt)`.

Endpoints (all behind `protect`):

```
GET    /api/messages/conversations              list mine (CS: all, with search + unread filter)
POST   /api/messages/conversations              find-or-create my thread with CS
GET    /api/messages/conversations/:id/messages paginated history
POST   /api/messages/conversations/:id/messages send
PATCH  /api/messages/conversations/:id/read     mark thread read
GET    /api/messages/unread-count               badge
```

Authorization: a participant check in the service, plus `requireRole("cs")` on the CS-only listing —
consistent with how `notify` is gated. Sending a message fires `message_received` **through the existing
emitter**, so the chat inherits the bell and (per §3.4) email for free.

### 4.3 Transport: polling, not websockets

React Query polling — ~5s while a thread is open, ~20s for the list and badge. The app already polls the
unread count every 30s, so this adds no infrastructure and works through nginx and ngrok unchanged.
Websockets (socket.io) would give true realtime but add a dependency, a second auth path, and sticky-session
concerns in deployment. For duty coordination, a few seconds' latency is invisible. Easy to upgrade later —
the API shape doesn't change.

### 4.4 UI — teacher side (deliberately minimal)

One sidebar item, **Messages**, opening a single thread with the Controller's office. No conversation list,
no "who do I pick", no new-message dialog — chat bubbles, a text box, send. Plus a **Message CS** button on
duty cards and change requests that opens that same thread with the duty context attached, so a teacher
asking "can I swap this?" doesn't have to explain which duty.

### 4.5 UI — CS side (an inbox that scales)

Two-pane layout, reusing existing patterns:

- **Left:** conversation list — teacher name, department, snippet, timestamp, unread badge. Search by name
  or department, filter All / Unread.
- **Right:** the thread, plus a composer.
- **Context panel:** who this teacher is — designation, department, duty counts, and the existing
  `ContactActions` component for call / WhatsApp, so CS can escalate off-app in one tap.
- Unread total in the Navbar next to the bell — **separate icon from the bell**: system notifications and
  human conversations shouldn't share a counter.

Optional (say if you want it): canned replies for the questions CS answers repeatedly.

---

## 4b. What is built (Phases 1 & 2)

**New — `backend/modules/mail/`**

| File | Role |
| --- | --- |
| `emailOutbox.model.js` | queue + delivery audit (`pending/processing/sent/failed/skipped`, attempts, errors) |
| `mail.policy.js` | per-type email mode, non-optional duty types, per-user gate (prefs-ready) |
| `mail.transport.js` | `console` (default) / `gmail` / `smtp`, memoized, falls back to console on missing creds |
| `mail.templates.js` | branded HTML + plain-text, duty details table, deep link |
| `mail.service.js` | enqueue (single + batch); never throws into callers |
| `mail.dispatcher.js` | 20s drain + 1s nudge, atomic row claim, retries 1m→5m→15m→1h |

**Changed**

- `notification.emitter.js` — all four entry points now queue email alongside the notification, passing the caller's `session`.
- `shared/utils/datetime.js` (new) — date/time formatters now shared by the in-app and email templates so wording can't drift.
- `notification.model.js` / `notification.templates.js` — five new types.
- `duty.service.js` — `duty_self_claimed` on both self-claim paths; CS alerts; `cancelDuty(id, reason, actor)`; `getTeacherIdsForSchedules`.
- `dcsGroup.service.js` — DCS self-claim confirmation + CS alerts on claim and release.
- `examGroup.service.js` — `exam_updated` fan-out, gated on duty-relevant field changes.
- `user.service.js` — `getCsUserIds()` so other domains resolve CS recipients through a service.
- Frontend — new types in the union, bell tones, and `exam_updated` in the dashboard popup feed.
- `tests/11-notification-events.test.js` — self-claim, CS awareness, self-release vs CS cancellation.
- `backend/scripts/mail-outbox-report.js` — delivery report (`--failed`, `--retry`).

**Deliberately not built** (deferred, as agreed): per-user preference UI, the `exam_created` daily digest,
per-broadcast email toggle, a CS-facing delivery log endpoint, and messaging.

**Correction to §2.2:** `exam_updated` was described as covering a date/time change. There is no
schedule-update endpoint — schedules are create/delete only — so a per-slot time change arrives as a
delete + recreate, which the existing deletion cascade already notifies. `exam_updated` therefore covers
group-level edits (dates, exam type, semester).

## 4c. Verification status (2026-09-30)

**Verified**
- Every backend module loads; `app.js` mounts clean.
- `cd frontend && npm run build` (the CI type-check gate) passes with the new notification types.
- Policy resolution, transport selection, and all email + notification templates smoke-tested.
- Email HTML reviewed in a browser. That review caught three defects, since fixed:
  1. **No `<meta charset>`** — em-dashes in building labels (`Academic Block — 004`, used app-wide)
     rendered as mojibake when the mail was opened standalone. The template now emits a proper `<head>`.
  2. **Multi-duty reminder was misleading** — "You have 3 duties" followed by a single Date/Time/Room
     row, which reads as the whole day's detail. Now renders `Duties: N that day` + `First duty: …`.
  3. **`exam_deleted_duty_release` printed its details twice** — its message body already enumerates
     them, so it is now marked self-describing and skips the details table.

**Not verified — needs MongoDB**
- The outbox row being written inside the caller's transaction.
- The dispatcher drain loop (claim → render → send → mark).
- **Rollback safety** — the property the whole outbox design exists for.
- The six new notification events end to end (`tests/11-notification-events.test.js` has never run).

MongoDB here runs only through Docker Desktop, whose daemon was unresponsive for the whole session.
Because `withOptionalTransaction` silently no-ops on standalone Mongo, the transaction behaviour can
only be tested against a **replica set**:

```bash
docker run -d --name proctavo-mongo -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
docker exec proctavo-mongo mongosh --quiet --eval 'rs.initiate()'
cd backend && node scripts/seed-users.js && npm run dev   # emails print as [mail:console] lines
cd backend && node scripts/verify-mail-outbox.js          # proves rollback safety + the drain loop
cd tests && npm test                                      # existing suites + 11-notification-events
node backend/scripts/mail-outbox-report.js                # what got queued and sent
```

Nothing can actually send until `MAIL_TRANSPORT` is pointed at a real server — sender choice was
deliberately deferred.

## 5. Build order

| Phase | Delivers | Touches |
| --- | --- | --- |
| **1. Email infrastructure** | every notification that exists today also arrives as email | new `mail/` module, `emitter.js`, `EmailOutbox`, env, scheduler |
| **2. Notification gaps** | self-claim confirmation, CS visibility, `exam_updated` | `templates.js`, `duty.service.js`, `dcsGroup.service.js`, exam services |
| **3. Preferences + CS controls** | Settings page, per-broadcast email toggle, delivery log for CS | `User` model, `notify` composer, new settings UI |
| **4. Messaging** | backend module + teacher thread + CS inbox | new `message/` module, new frontend module, Navbar |
| **5. Polish** | digests, quiet hours, unread-triggered message emails | sweeps in `notification.jobs.js` |

Phase 1 alone satisfies "teachers get an email when something changes". Phase 2 is what makes your
self-claim example work at all. Phases 1–2 are the meaningful milestone; 3–5 are refinement.

Tests: new API suites for messages and preferences following the existing `tests/NN-*.test.js` pattern,
with `MAIL_TRANSPORT=console` in CI so nothing is ever actually sent from a test run.

---

## 6. Things I need from you

1. **Sending account** — which Gmail sends this, and is it a Workspace account or consumer? A consumer
   account caps at ~500 recipients/day, which one exam-publish broadcast can exhaust.
2. **Chat scope** — teacher ↔ CS only (my recommendation), or teacher ↔ teacher too?
3. **Real addresses** — do the teacher records in production carry real, deliverable email addresses? The
   seeded ones (`@examduty.com`) are not real, so Phase 1 needs a verified test recipient to prove delivery.

## 7. Risks

- **Gmail daily caps** under broadcast load — mitigated by digesting `exam_created` and the per-broadcast
  opt-in, but a provider swap is the durable fix.
- **Deliverability** — mail from a consumer Gmail to a whole institution can land in spam. A verified
  sending domain on a transactional provider is materially better.
- **Bounces from fake seeded addresses** — hence `console` transport everywhere except production.
- **Notification fatigue** — the reason for the policy table and preferences rather than "email everything".
- **Password reset / login emails** are *not* in this scope, though the same mail layer would serve them.
  Say the word if you want it folded in.
