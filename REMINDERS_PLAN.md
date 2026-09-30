# Reminders, Confirmation & Responsiveness — Implementation Plan

**Status:** built 2026-10-01 — §4: **no open tracking**, **flag to CS only** (never auto-release), **30-min reminder by email + in-app**. Verified: `scripts/verify-reminders.js` 21/21, `verify-calendar.js` 22/22, API suite 119/119 (new `13-confirmation`), frontend build.

**Built as planned, with two adjustments:** reminder wording names the absolute date ("on 1 October 2026"), never "tomorrow", per the existing stale-reminder rule; and the responsiveness endpoint lives in the previously empty `report` module (`GET /api/reports/responsiveness`) since it reads from four modules' services.

**Ask:**
1. Remind teachers **3 days, 1 day and 30 minutes** before each duty.
2. Know whether a teacher has **seen** the email and **accepted** the duty; if not, **remind them to confirm**
   (or to **select** duties, for teachers who haven't picked enough), more urgently as the duty gets close.
3. Give CS a view of **who isn't responding** or isn't selecting duties.

---

## 1. Where things stand today

| Piece | State |
|---|---|
| Reminders | One sweep (`notification.jobs.runDutyReminderSweep`) sends "you have duty tomorrow" once per teacher per day. It runs every **6 hours**, so a 30-minute reminder is impossible with the current scheduler. |
| Calendar invites | One alarm, 1 hour before. Invites say `RSVP=FALSE` — nobody is asked to accept. |
| "Accepted" | No such concept. A CS-assigned duty is simply `assigned`; nothing records that the teacher knows about it. |
| "Seen" | Nothing tracked. The outbox knows an email was **sent**, not read. |
| CS view | Reports has `LowCompletionTeachers` (target progress). Nothing about responsiveness. |

## 2. Honest limits — what can and can't be measured

- **"Opened the email" can't be measured reliably.** The only method is a hidden tracking image, and it
  lies both ways: Apple Mail downloads every image automatically (so everything looks "opened"), Gmail
  caches images through its proxy, and Outlook often blocks images (so real reads look "unopened").
  Useful at most as a rough hint.
- **"Accepted in the calendar" can't be read without mailbox access.** Accept/Decline replies would go to
  the noreply mailbox; reading them needs Microsoft Graph/IMAP access plus reply parsing, and many clients
  don't send a reply at all.
- **What *is* reliable: an explicit confirmation.** A **"Confirm I'll be there"** button in the email
  (a one-click signed link — no login) and in the app. That's the "accepted" signal everything else
  builds on. Clicks on that link are also the best available proof the email was seen.

## 3. What gets built

### A. Timed reminders — 3 days, 1 day, 30 minutes
- Per **duty unit** (invigilator room, or whole RS/DCS group — one reminder, not one per room), keyed on the
  unit's real start time, not the calendar day.
- In-app + email for each. Deduped per `teacher + unit + stage`, so restarts never double-send.
- Scheduler gains a **5-minute tick** for the time-critical checks (the 30-min reminder, CS escalations);
  the 6-hourly sweeps stay as they are. The existing "tomorrow" reminder becomes the 1-day stage.
- Calendar invites carry the same three alarms. Apple/Outlook honour invite alarms; **Google ignores them**
  and uses the teacher's own default — which is exactly why the app's own reminders are the reliable ones.

### B. Confirmation ("accepted")
- `Duty.confirmedAt` / `confirmedVia` (`email` | `app`), set on every room of a group at once.
- **CS-assigned duties start unconfirmed. Self-claimed duties are confirmed automatically** — the teacher
  chose them.
- Email: "Confirm I'll be there" button → `GET /api/duties/confirm/:token` (signed, expiring, single-purpose
  token; shows a small "Confirmed ✓" page). App: a Confirm button on the teacher's upcoming duty cards and
  the dashboard popup. Unassigning or reassigning a duty clears it.
- "Can't make it" link → opens the teacher's existing change-request (drop) flow, so CS still approves.

### C. Nudges
| When | Who | What |
|---|---|---|
| Unconfirmed 24h after assignment | Teacher | "Please confirm your duty on …" (in-app + email) |
| Unconfirmed at the 3-day reminder | Teacher | Reminder is marked urgent, confirm button up front |
| Unconfirmed 1 day before | **CS** | "Teacher X hasn't confirmed tomorrow's duty at …" (in-app; one per teacher per day) |
| Below target, an exam with open slots starts in ≤ 7 days | Teacher | "Please select your duties for …" (once per exam per stage: 7 days, 3 days) |

### D. CS responsiveness view
New **Responsiveness** tab in Reports, one row per teacher:
upcoming duty units · confirmed · awaiting confirmation (with the oldest wait) · average time to confirm ·
reminders/nudges sent · target progress (selected vs target) · last active in the app ·
(optional) email opened, marked approximate.
Filter **"Not responding"** = awaiting confirmation > 48h, or still below target 48h after a select-duty nudge (a nudge sent minutes ago isn't "ignored" yet).
Plus an "Awaiting confirmation" badge on duty rows in Teacher Details and the exam room view.

### E. Tests
API suite: confirm via app and via token; bad/expired token; self-claim auto-confirmed; unassign clears it;
responsiveness endpoint numbers. `verify-reminders.js` (DB-level, like the calendar one): each stage fires once
at the right time, groups fire once, nudge + CS escalation timing.

## 4. Decisions for you
1. **Email open tracking** — add it as an "approximate" column, or skip it and rely on confirmations?
2. **If a teacher never confirms** — just flag them to CS, or auto-release the duty at some point?
3. **30-minute reminder** — email + in-app, or in-app only (email may be read too late to matter)?

## 5. Build order
1. Confirmation (B) — the signal everything else uses.
2. Timed reminders + 5-minute tick (A).
3. Nudges + CS escalation (C).
4. Responsiveness tab + badges (D).
5. Tests, then a real run to your inbox.
