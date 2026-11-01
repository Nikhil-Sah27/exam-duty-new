# Ads in Proctavo: plan

**Status (1 Nov 2026):** steps 1–3 are built, and step 4 is under way. The real AdMob IDs are in: App ID
`ca-app-pub-2753291183102591~8851230606` (`mobile/app.json`), banner `…/8077204984` and interstitial `…/3900167157`
(`mobile/src/features/ads/adUnits.ts`), plus `proctavo.com/app-ads.txt` and the privacy policy's Ads section. The
1.3.0 production bundle builds next; the Play declarations change when it's submitted. Every switch starts off, so
nobody sees ads until the superadmin turns them on.

**The request:** banner ads in the app, with more ads for teachers who put things off. A teacher who hasn't picked
their duties, or who didn't turn up for one, sees more ads, and the longer they leave it, the more they see. The admin
website can turn all of this off.

## In short

- **Who sees ads.** Every teacher sees **one small banner** on Home. A teacher who is behind sees more banners each
  day they stay behind, and at the top level one full-screen ad a day. A teacher who missed a duty sees extra ads
  for a while afterwards.
- **What the app shows.** Whenever there are extra ads, it says *why*, with a button to fix it ("Select 2 more
  duties to remove the extra ads"). The extra ads stop as soon as the teacher catches up; the base banner stays.
- **Who decides.** The backend works out each teacher's ad level. The app only displays it.
- **Switches.** The superadmin console gets an **Ads** switch per college and a **platform-wide master switch**.
  Turning either one off removes ads the next time the app opens.
- **Delivery.** The ad library is native code, so it ships as a new build, **1.3.0**, after Google approves 1.2.0
  (in review now, declared "no ads").

## When a teacher sees ads (the nudge rule)

There are two triggers (decision Q2). "Hasn't confirmed" was left out.

| Trigger | How it's detected | Already in the code |
|---|---|---|
| **Hasn't chosen their duties**: below their target while an exam still has open slots | Teacher progress (`assigned` < `target`) plus exams with open slots | Yes: the select-your-duty nudge in `notification/reminder.jobs.js` (`examGroupsWithOpenSlots`, `calculateAllTeachersProgress`) |
| **Didn't show up** for a duty | Not recorded today. CS marks a duty unit "absent" after the exam | No: new feature, Phase 2 |

**Levels, worked out each day:**

| Level | When | What they see |
|---|---|---|
| 0 | Ads switched off (master or college), or the user is acting as CS | Nothing. The SDK doesn't even load |
| 1 | Every teacher (base, decision Q4) | One banner at the bottom of Home |
| 2 | Behind for 1 day | Level 1, plus the "why" strip with a fix-it button, plus a banner on the Select Duty list |
| 3 | Behind for 2–3 days | Level 2, plus banners on Completed duties and Alerts, plus a second banner inside the Home list |
| 4 | Behind for 4+ days, **or** a no-show in the last 14 days | Level 3, plus **one interstitial a day** (decision Q3) |

**Interstitial rules.** At most one a day, shown at a natural pause: returning to Home from another screen. It's never
shown at app launch or exit, within 2 hours of a duty alarm, or on the select or confirm screens.

**No-show window.** A no-show lifts the teacher to level 4 for 14 days. The reason strip says when it ends
("You missed your duty on 5 Nov · extra ads until 19 Nov"). The 14 days is one constant, easy to change.

**Never shown:**
- on the alarm screen (Play's disruptive-ads policy);
- on login or role selection;
- inside the screen where they select a duty or confirm one, because ads must never get in the way of the thing we want them to do;
- on CS screens.

CS is never nudged.

## Design

### 1. Backend: a new `ads` module

The module follows the repo's rules:
- **Pure rule.** `ads/adNudge.utils.js` turns a teacher's state (behind-since date, latest no-show) plus today's
  date into `{ level, reasons[] }`. It does no database work, so it's easy to test.
- **Service.** `ads.service` loads that state by calling other modules' services (duty-calculation, exam, duty).
  It never reads their models or repositories, so the architecture check keeps passing. It then calls the pure rule
  and combines the result with the switches.
- **Endpoint.** `GET /api/ads/status` (any signed-in teacher, own data only) returns `{ level, reasons }`.
- **"Behind since".** Stored per teacher and per reason (a small `AdNudge` record, scoped by college like every
  other model), so "days behind" is counted from when they actually fell behind. It's cleared when they catch up.
- **Switches.**
  - An `ads` entry in `shared/tenancy/features.js`. It has no exam types, so the exam filter ignores it.
  - A platform `adsEnabled` master setting.
  - Either switch off means level 0 for everyone.
- **Proof.** Unit-level cases for the pure rule, plus an API test that checks the following:
  - an up-to-date teacher gets level 1;
  - a below-target teacher gets level 2 or higher;
  - selecting duties drops them back to level 1;
  - switches off means level 0;
  - a CS account gets level 0;
  - one teacher can't read another's status.

### 1b. No-shows (new: CS marks absences)

- **What CS does.** After an exam slot ends, CS can mark a teacher's duty unit **absent**. A unit is one per
  teacher + schedule + role, so an RS or DCS group is marked as a whole, through `duty.unit.js`. CS can undo it.
- **Data.** `Duty.absentAt` and `Duty.absentMarkedBy`, set on every duty in the unit. The route is
  `PATCH /duties/admin-mark-absent { dutyId, absent }`, guarded by `requireRole("cs")`. Marking a duty that
  hasn't ended yet returns a 400.
- **Teacher alert.** The teacher gets a `duty_marked_absent` notification through the emitter: inbox, push and email.
  The wording lives in `notification.templates.js`. Undoing it sends nothing.
- **Where CS does it.** A "Mark absent" action in the exam room `DutyStatusModal` and on Teacher Details, shown
  only for past duties. The CS Responsiveness report gains a no-shows column.
- **Proof.** An API test checks that only CS can mark, that it can't be done before the duty ends, that a whole RS
  group is marked together, and that undo works.

### 2. Web (superadmin console)

- The Ads switch appears per college next to CIE and SEE. Today, turning a switch off opens a dialog saying exams
  will be hidden. That wording is about exams, so the ads switch skips the dialog.
- A "Platform settings" card holds the master switch.

### 3. App (mobile)

- **Library.** `react-native-google-mobile-ads` with its Expo config plugin (native, so a new EAS build).
- **Code layout.** A new `features/ads/` folder holds:
  - `useAdLevel()`, which calls `GET /api/ads/status` and refetches when the app returns to the foreground and
    after a duty is selected (so the extra ads drop away right away);
  - `AdSlot` (a banner that appears only at or above a given level);
  - `AdReasonStrip` (the "why", with a fix-it button);
  - `useDailyInterstitial` (level 4: once a day, at the pause described above).
  - The query key goes in `lib/queryKeys.ts`.
- **Nothing loads at level 0.** The SDK starts only when the level is 1 or higher. At level 0 there are no ad
  requests and no tracking.
- **Consent.** Google's consent form (UMP, in the same library) runs before the first ad request.
- **Test IDs outside production.** Development and preview builds use Google's test ad units, and the real IDs
  live only in the production profile. AdMob bans accounts that click their own live ads.

### 4. Google paperwork (ships together with 1.3.0)

1. **AdMob account.** You create it at admob.google.com with the Play account (avigupta2001ad@gmail.com) and link it
   to the Play app. It gives you an App ID and ad unit IDs. They aren't secret. I can't create accounts.
2. **`proctavo.com/app-ads.txt`**, with the line AdMob gives you.
3. **Privacy policy.** A new section covering:
   - ads, with AdMob as the provider and what it collects;
   - that ads show only while a teacher has pending duty actions;
   - how to opt out of personalised ads.
4. **Play Console** (and `PLAYSTORE.md`):
   - Ads: **Yes**. The listing then shows the "Contains ads" label.
   - Advertising ID: **Yes**.
   - Data safety: add the AdMob data (device IDs, approximate location, app interactions, diagnostics), shared
     with Google for advertising.
   - Don't change any of this while 1.2.0 is in review. Change it in the same submission as 1.3.0.

## Know before deciding

- **Check with the colleges.** Ads used as a nudge put pressure on their staff, so each college should agree before
  its switch goes on. That's another reason the per-college switch starts **off**.
- **Play's view.** Showing different users different numbers of ads is fine. Ads must not be deceptive and must not
  block normal use, which is why the app always shows the reason and never covers the select or confirm screens.
  Interstitials are where policy risk sits: no ads at launch, at exit, or near the alarm.
- **Revenue.** Few users and low banner rates in India mean little money. The real value here is the nudge.
- **No-shows.** These need data we don't have yet, so CS marks absences after an exam (Phase 2).

## Build order

1. ✅ **Backend and web: switches and the nudge rule.** The pure rule, the `ads` module and endpoint, the switches,
   the superadmin UI and the tests. This can deploy right away. Every switch starts off, so nobody sees anything,
   and the app has no SDK yet anyway.
2. ✅ **No-shows.** Marking absences (backend, CS web UI, notification, tests). This is useful on its own even before
   ads ship.
3. ✅ **App.** SDK, `features/ads`, the reason strip, the slots, the daily interstitial, consent, test IDs, and a
   preview APK for your phone.
4. **Go live.** AdMob IDs, `app-ads.txt`, the privacy policy, the Play declarations, then the 1.3.0 bundle sent for
   review. This waits until 1.2.0 is approved, and needs the AdMob account you create.

## As built (steps 1–2)

- **Backend.** `modules/ads/` holds:
  - `adLevel.utils.js` (the pure level rule);
  - `AdSettings` (the master switch) and `AdNudge` ("behind since");
  - `GET /api/ads/status`, plus `GET/PATCH /api/platform/ads` for the superadmin.

  The "behind" rule moved from `notification/reminder.jobs.js` into
  `dutyCalculation.findSelectionShortfall` + `selectionShortfall.utils`, so the select-your-duty nudge and the ad
  level share it. The 6-hourly sweep keeps `AdNudge` current for colleges with ads on.
- **No-shows.** `Duty.absentAt` / `absentMarkedBy`, `PATCH /api/duties/admin-mark-absent`, the `duty_marked_absent`
  alert (inbox, email, push), and audit actions `ADMIN_MARK_ABSENT` / `ADMIN_UNMARK_ABSENT`.
- **Web.**
  - Superadmin: the master switch on the Colleges page and an Ads section on each college.
  - CS: Mark absent / Undo on past duties in Teacher Details (flat duties, RS and DCS groups), with a confirm step.
  - Not done: the exam-room `DutyStatusModal` action and a no-show column in the Responsiveness report.
- **Proof.** `tests/21-ads.test.js` (14 tests); the full suite passes (`npm test`).
- **Open question.** An absent duty still counts as *completed* toward the teacher's target. Should a no-show stop
  counting?

## As built (step 3, app 1.3.0)

- **Library and config.** `react-native-google-mobile-ads` 17.4. Its config plugin in `mobile/app.json` carries
  Google's **sample** App IDs, plus `delayAppMeasurementInit`, so the SDK collects nothing until the app starts it.
- **Code.** `mobile/src/features/ads/`:
  - `useAdStatus` queries `GET /api/ads/status` for teachers only. It refetches on app foreground and after a claim
    (`CLAIM_INVALIDATIONS`).
  - `useAdLevel` returns 0 until `startAds()` has gathered Google's consent (UMP) and initialized the SDK. The SDK
    never starts at level 0.
  - `AdSlot minLevel` renders a labelled 320×50 banner.
  - `AdReasonStrip` gives the why and the fix.
  - `useDailyInterstitial` (Home) handles the level-4 ad; `interstitialRule` holds its rule: once a day, only when
    returning to Home, never in the 3 hours before or during a duty.
- **Placements.**
  - Home: the strip, a banner at level 3+, and the base banner at the end.
  - Select Duty list: level 2+.
  - Completed duties and Alerts: level 3+.
- **Which ads.** `adUnits.ts` picks by the build's EAS channel. `production` uses `LIVE_UNITS`, which stay null (so
  no ads) until go-live. Development and preview use Google's test units.

**Go-live swap (step 4):** set the real App ID in `app.json`, the real banner and interstitial unit IDs in
`adUnits.ts`, add `app-ads.txt`, update the privacy policy and Play declarations, then build the 1.3.0 production
bundle.

## Decisions (1 Nov 2026)

- **Q1. Who controls the switches?** **The superadmin only.** Per-college switch plus platform master switch,
  every college off until switched on.
- **Q2. Triggers?** **"Hasn't chosen duties" and "didn't show up".** Unconfirmed duties don't trigger ads.
- **Q3. Top-level escalation?** **Banners plus one interstitial a day**, under the interstitial rules above.
- **Q4. Teachers who aren't behind?** **A small base banner for everyone** (level 1). Procrastinators get more on top.
