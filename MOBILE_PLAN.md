# Mobile App + Duty Alarms — Plan

**Status:** approved 2026-10-07 — Phase 1 (backend) **built and verified**; Phase 2/3 (app) in progress. Decisions in §6.

**Goal:** a phone app for **Invigilators, RS and DCS** that (1) pushes every duty alert to the
phone and (2) **rings like an alarm clock** before each duty, so nobody misses one.
CS keeps using the web dashboard.

---

## 1. What exists today

| Piece | Where | Reused by the app? |
|---|---|---|
| Every user-visible event goes through one choke point | `notification/notification.emitter.js` (`emit`, `emitIfAbsent`, `emitToMany`, `bulkEmit`) | **Yes** — push hooks in here, exactly like email did |
| Email = transactional outbox + dispatcher, per-type policy | `mail/emailOutbox.model.js`, `mail.dispatcher.js`, `mail.policy.js` | **Pattern copied** for push |
| 3d / 1d / 30m reminders, confirm nudges, select-duty nudges | `notification/reminder.jobs.js` (5-min tick) | **Yes** — they become pushes for free |
| Duty "unit" (RS/DCS group = one unit) | `duty/duty.unit.js` | **Yes** — one alarm per unit, not per room |
| Local wall-clock → UTC (`APP_TIMEZONE`) | `shared/utils/datetime.js` `localToUtc` | **Yes** — server sends the phone an exact UTC instant |
| Login / tempToken / select-role / forgot-password OTP / confirm duty | `/api/auth/*`, `POST /duties/:id/confirm` | **Yes**, unchanged |

**What's missing:** no device registry, no push channel, no "my upcoming duty units" endpoint, and
**the web UI is not phone-friendly** (fixed 240 px desktop sidebar, no mobile breakpoints) — so
wrapping the website in an app shell would give a poor experience. Hence a native app.

**This Mac:** Android Studio + SDK + bundled JDK ✅ (Android builds possible locally).
**No Xcode** ❌ — iOS builds must go through Expo's cloud build (EAS).

---

## 2. Approach (recommended)

**Expo (React Native, TypeScript)** app in a new `mobile/` folder — same language, React Query and
Zustand as the web frontend. Cloud builds for iOS, local or cloud builds for Android.

Two independent alert paths, so an alarm still rings even with no internet at duty time:

```
 Server events ──► emitter ──► PushOutbox (same txn) ──► push.dispatcher ──► Expo Push ──► phone
   (assigned, cancelled, swapped, reminders, announcements…)        "Duty assigned …" 🔔

 Phone ──► GET /api/duties/my-units ──► schedules LOCAL ALARMS on the device ──► ⏰ rings at T-60 / T-20
          (on open, on every push received, on foreground, after confirm)
```

### 2a. Alarm behaviour (the "it actually rings" part)

| | Android | iPhone (iOS 26+) | iPhone (older iOS) |
|---|---|---|---|
| Rings at exact time, app closed | ✅ `AlarmManager` alarm-clock trigger | ✅ Apple **AlarmKit** (real system alarm) | ✅ scheduled notification |
| Loud, loops until dismissed | ✅ custom alarm sound, looping | ✅ | ⚠ one ≤30 s sound |
| Rings in silent / Do Not Disturb | ✅ alarm channel bypasses DND | ✅ AlarmKit breaks through silent & Focus | ❌ respects silent switch |
| Full-screen over lock screen | ✅ alarm screen: **Dismiss · Snooze 5 min · I'm on my way** | ✅ system alarm UI | ❌ banner only |

Libraries: [`react-native-notify-kit`](https://github.com/marcocrupi/react-native-notify-kit)
(the maintained fork of Notifee, which was archived in April 2026 — full-screen alarm intents, Expo
config plugin) for Android; [`react-native-nitro-ios-alarm-kit`](https://github.com/Gautham495/react-native-nitro-ios-alarm-kit)
for iOS 26+; `expo-notifications` for push tokens and older iOS.

**Default alarm times:** 60 min and 20 min before duty start, plus an optional "morning of" alarm.
Each teacher can change these in Settings (toggles: Morning of 7:00 · 2 h · 1 h · 30 min · 20 min · 10 min).

**Staying correct:** alarms are re-synced against the server on every app open, every push
received, and after every confirm. A cancelled or swapped duty removes its alarm; if a stale alarm
fires anyway, the alarm screen re-checks and shows *"This duty was cancelled"* rather than sending
someone to a room.

**Server push sounds:** normal notification sound for assignments/changes; the server's 30-min
reminder push is a high-priority alert. (Local alarms at 60/20 min don't collide with it.)

---

## 3. Build phases

### Phase 1 — Backend: push channel ✅ built 2026-10-07

Verified against a throwaway replica-set Mongo: all 126 existing API tests pass with push wired in;
the new `15-push` suite passes 11/11 (twice on the same DB, after making its room labels unique);
one push row per pushable notification and zero orphans from rolled-back race losers. Deviation from the draft: `request_submitted` does **not** push (it goes to CS reviewers).

New module `backend/modules/push/` following the mail pattern:

- `deviceToken.model.js` — `{ user, token (unique), platform, appVersion, lastSeenAt }`.
- `push.routes.js` — `POST /api/push/devices` (register/refresh, `protect`), `DELETE /api/push/devices/:token` (logout).
- `pushOutbox.model.js` + `push.dispatcher.js` — written **in the same transaction** as the
  notification (a rolled-back duty never buzzes a phone); sent after commit via Expo Push API
  (`expo-server-sdk`), batched; failures swallowed; dead tokens (`DeviceNotRegistered`) deleted.
- `push.policy.js` — per-type on/off, mirroring `mail.policy.js`: all teacher-facing duty/request/
  reminder/announcement types **on**; CS awareness alerts and the `exam_created` fan-out **off**.
- Emitter: one `queuePush` next to each `queueEmail` — every existing and future type gets push for free.
- `GET /api/duties/my-units` — the caller's live upcoming duty units (all their roles), built with
  `duty.unit.js`, each with an exact UTC `startsAt`/`endsAt`, role, exam label, building + rooms,
  confirmed flag. The phone needs no timezone logic.
- `PUSH_TRANSPORT` env: `console` (default — logs, sends nothing; local + CI) / `expo` (production).
- Tests: `tests/15-push.test.js` (device register/unregister, outbox rows on assign, my-units shape).

Safe on production immediately: no devices registered = dispatcher does nothing.

### Phase 2 — The app, Android first (≈ 2 days)
Screens for Invigilator / RS / DCS:
1. **Login** → role picker (multi-role users) → forgot password (OTP). CS-only accounts are told to use the web.
2. **Home — Upcoming duties**: one card per unit (role chip, exam, date/time, building + rooms,
   confirmed ✓) with **Confirm I'll be there**, and a "Next alarm: Tue 8:30 AM" banner.
3. **Notifications** inbox (existing `/api/notifications`, mark read). Tapping a push opens the relevant duty.
4. **Alarm screen** (full-screen when ringing) — Dismiss / Snooze / I'm on my way.
5. **Settings** — alarm times, **Test alarm now**, permission health check (notifications, exact
   alarms, full-screen, *battery optimisation* — important on Xiaomi/Oppo/Vivo/Realme phones, which
   kill background apps), switch role, log out.

Deliverable: an installable **APK link** for Android testers.

### Phase 3 — iPhone (depends on Apple account, see §5)
Same app built in the cloud with EAS → TestFlight → App Store. AlarmKit on iOS 26+.

### Phase 4 — Later (not in this plan's first cut)
Select Duty (invigilator rooms, RS groups via the shared `groupRoomsIntoRSGroups` logic, DCS
groups), Change Requests, Messages with CS. Until then the app links to proctavo.com for these.

---

## 4. Risks & honest limits

- **Android 14+ permissions:** exact alarms and full-screen alarm screens need the user to allow
  them; the app walks them through it in Settings. Google Play restricts full-screen intents to
  alarm/calling apps — a duty-alarm app qualifies, but if Play pushes back the fallback is a
  looping heads-up alarm notification (still loud, still bypasses DND). Direct APK installs aren't affected.
- **Chinese-OEM battery killers** can delay pushes; alarm-clock alarms are the most resilient
  thing Android offers, and the setup screen asks users to whitelist the app.
- **iPhone below iOS 26:** cannot ring in silent mode (Apple only allows that via AlarmKit, or a
  "critical alerts" entitlement that is rarely granted to apps like this).
- **Teacher not logged into the app** → only email/in-app, as today. The app is additive.

---

## 5. Accounts needed (owner: client / you)

| Need | Why | Cost |
|---|---|---|
| **Expo account** (expo.dev) | cloud builds + push service | free |
| **Firebase project** (`google-services.json` + FCM service-account key uploaded to Expo) | Android push delivery | free |
| **Apple Developer Program** (client's org) | any iPhone install beyond dev, APNs, App Store | $99/yr |
| **Google Play Console** (optional — APK link works without it) | Play Store listing | $25 once |
| Production `.env`: `PUSH_TRANSPORT=expo` | turn real pushes on | — |

App identity proposal: name **Proctavo**, bundle id `com.proctavo.app`, existing logo mark as icon.

---

## 6. Decisions (2026-10-07)

- **Approach:** native Expo (React Native) app in `mobile/` — not a web wrapper.
- **First cut includes native Select Duty** (invigilator rooms, RS groups, DCS groups) alongside
  login, upcoming duties + confirm, notifications, alarms and settings — Phase 4's Select Duty
  moves into Phase 2. Change Requests and Messages still link to the website for now.
- **Platforms:** Android **and** iPhone together (Phase 3 runs alongside Phase 2; iOS needs the
  Apple Developer account in §5 before it can be installed on phones).
- **Default alarms:** 1 h and 20 min before duty start; editable per teacher in Settings.
