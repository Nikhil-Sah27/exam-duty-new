# Calendar Invites — Implementation Plan

**Status:** built 2026-10-01 — §5 answered: **keep both emails** (invite in addition to the plain notification), **backfill** existing upcoming duties (the first sweep after deploy does it). Verified: `backend/scripts/verify-calendar.js` 22/22, API suite 110/110, real invites delivered to the dev inbox.

**Ask:** invigilators, RS and DCS should see their exam duties in their own calendar (Google Calendar,
Outlook, Apple) without anyone handing over calendar API access.

---

## 1. Approach — standard calendar invites from `noreply@proctavo.com`

The app emails a standard iCalendar invite (`text/calendar`, `METHOD:REQUEST`) for each duty. Every
mainstream calendar understands it: Gmail shows the event card with "Add to calendar" and usually adds
it straight to Google Calendar; Outlook and Apple Mail do the same. No Google/Microsoft API, no OAuth,
no per-teacher setup.

- **Organizer** is `noreply@proctavo.com` (the Microsoft 365 mailbox already sending our email), the
  teacher is the only attendee, `RSVP=FALSE` — nobody is asked to accept or decline.
- **Updates and cancellations** reuse the event's fixed `UID` with a higher `SEQUENCE`: a changed time
  moves the event, `METHOD:CANCEL` removes it. That's how a calendar stays in sync without API access.
- Sent through the existing outbox + dispatcher (nodemailer's built-in `icalEvent`) — no new package,
  and invites inherit the retry/audit/rollback-safety we already have.

## 2. Why state-based sync, not "attach to each notification"

Duties change in more places than the notification emails cover. These change a teacher's duties but
send that teacher **no email today**: a DCS releasing their own group, change-request drops and swaps
(the approval email carries no duty details), exam edits for RS/DCS, exam deletion. Attaching an invite to
each notification would leave those calendars wrong.

So calendars are **reconciled from the `Duty` collection**, not from events:

- **One calendar event = one duty unit** — a teacher's duty in one exam slot. A teacher can hold only
  one duty per time slot (`findTeacherConflict`), so *teacher + schedule* identifies it exactly: an
  invigilator room, a whole RS group, or a whole DCS group is **one** event (matches "group = one unit").
  Legacy duties with no schedule key on the duty id.
- New `CalendarEvent` collection remembers what each teacher was last sent: `{ teacher, key, uid,
  sequence, fingerprint, status }`.
- `calendarSync.syncTeacher(id)` compares the teacher's live upcoming duty units with those rows and
  queues only the difference: new/changed unit → `REQUEST`, vanished unit → `CANCEL`, unchanged → nothing.
  Idempotent — running it twice sends nothing the second time.

**Triggers**
1. **Fast path:** any duty-related notification (`duty_*`, `exam_updated`, `exam_deleted_duty_release`,
   `request_approved`) marks its recipient for sync; the dispatcher reconciles them on its next 20s pass —
   after the transaction has committed, so a rolled-back assignment produces no invite.
2. **Safety net:** the existing 6-hourly sweep reconciles every teacher with upcoming duties, catching the
   flows above that notify nobody.

## 3. What gets built

**Backend** — new `backend/modules/calendar/` (service-only, like `mail`):
- `calendarEvent.model.js` — the sent-state rows above.
- `calendar.ics.js` — builds the VCALENDAR: summary "Exam duty — IA1 · Sem 6 · Invigilator",
  location "Main Block — 101" (RS/DCS: "Main Block — 101, 102, 103…"), description with course, time,
  role, and a link to the app; times converted from the institution's local time (`APP_TIMEZONE`,
  default `Asia/Kolkata`) to UTC.
- `calendar.sync.js` — `syncTeacher`, `markDirty`, `runSweep`.
- Outbox: new row types `calendar_request` / `calendar_cancel` carrying the rendered `.ics`; the
  dispatcher passes it to nodemailer as `icalEvent`. `mail.policy.js` entries for both.
- DCS self-release now also notifies the DCS (a `duty_group_cancelled` "you released…"), like an
  invigilator's own release already does.
- Env: `CALENDAR_INVITES` (on/off, default **on**), `APP_TIMEZONE`.

**Tests** — `backend/scripts/verify-calendar.js` (DB-level, like `verify-mail-outbox.js`; the HTTP suite can't see the outbox): assign → one REQUEST row; unassign → CANCEL with the same UID
and a higher SEQUENCE; RS group → one event, not one per room; re-sync sends nothing; plus a unit check of
the `.ics` text (UTC times, UID, METHOD).

**No frontend change** — it's all email. (A "Copy my calendar link" feed is a possible later add-on.)

## 4. Limits worth knowing
- Gmail auto-adds invites only when the teacher's Google Calendar setting allows it (default: from known
  senders); otherwise the event card in the email is one click.
- Only teachers with real email addresses get invites — same as email notifications.
- Accept/decline replies (if a client sends one anyway) land in the noreply mailbox; they're ignored.

## 5. Decisions for you
1. **Two emails per assignment?** A new duty would produce the existing "New Duty Assigned" email *and*
   the calendar invite email. Keep both, or let the invite replace the plain email for new-duty types?
2. **Existing duties:** when this goes live, send invites for duties that are already assigned and still
   upcoming? (On production that's one burst of invites to everyone with upcoming duties.)

## 6. Build order
1. `.ics` builder + unit check.
2. `CalendarEvent` + `syncTeacher` + outbox/dispatcher wiring.
3. Triggers (fast path + sweep) and the DCS self-release notification.
4. API suite + a real invite to your own inbox, checked in Google Calendar.
