# Publishing Proctavo on Google Play

Everything Play Console asks for, ready to paste, and the release steps in order. The images are in
`play-store/`. The privacy policy is live at https://proctavo.com/privacy.

**Developer account:** personal (individual) account. **Developer name: `Earthling Aid Tech`**. It must match
the publisher named in the privacy policy (`frontend/src/modules/home/content/privacyPolicy.tsx`). Contact email
`services@earthlingaidtech.com`, website `https://proctavo.com`.

> New personal accounts must run a **closed test with at least 12 testers opted in for 14 days in a row** before
> they can publish to everyone. Day one is therefore internal/closed testing. Teachers from the college make
> ideal testers.

---

## 1. Create the app

| Field | Answer |
|---|---|
| App name | `Proctavo: Exam Duty Planner` |
| Default language | English (India) – en-IN |
| App or game | App |
| Free or paid | Free |
| Declarations | Tick Developer Program Policies and US export laws |

## 2. Store listing

**App name** (30 max): `Proctavo: Exam Duty Planner`

**Short description** (80 max):

```
See, pick and swap exam duties, with an alarm before each one.
```

**Full description** (4000 max):

```
Proctavo puts your exam duties on your phone and makes sure you never miss one.

Proctavo is the exam-duty planner colleges use to organise invigilation for internal assessments and semester-end exams. Your college's exam cell sets up the exams, rooms and duties; this app is where invigilators, Room Superintendents (RS), Deputy Chief Superintendents (DCS) and the exam cell handle their part.

YOUR DUTIES, IN ONE PLACE
• Every upcoming duty with its date, time, building and room
• Select your own duties from the rooms still open, or take the ones you're assigned
• Confirm a duty in one tap so the exam cell knows you'll be there
• Request a change or a swap when your plans move
• See your completed duties
• Message the exam cell directly
• Get an alert the moment a duty is assigned, changed or cancelled

AN ALARM BEFORE EVERY DUTY
Proctavo rings a real alarm before each duty: by default an hour before and again 20 minutes before. It's full-screen, rings even with the phone on silent, and has Snooze and "I'm on my way". Reminders also arrive 3 days, 1 day and 2 hours ahead.

FOR THE EXAM CELL
CS can follow exam status, review change requests and chat with teachers from the app.

HOW TO SIGN IN
Proctavo accounts are created by your college's exam cell. If your college uses Proctavo, sign in with the email and password they gave you. Learn more at proctavo.com.
```

| Field | Answer |
|---|---|
| App icon | `play-store/icon-512.png` (512×512) |
| Feature graphic | `play-store/feature-graphic.jpg` (1024×500, no transparency) |
| Phone screenshots | 4–8 portrait screenshots from the **demo account** (see §6). Never use a real college's data |
| Category | Education |
| Tags | Education, Productivity, Calendar |
| Email | services@earthlingaidtech.com |
| Website | https://proctavo.com |
| Privacy policy | https://proctavo.com/privacy |

## 3. App content (Policy → App content)

**Privacy policy:** `https://proctavo.com/privacy`

**App access:** *All or some functionality is restricted.* Add these instructions:

```
Proctavo accounts are created by a college's exam cell, so we've set up a demo college for review.
Email: reviewer@demo.proctavo.com
Password: <the DEMO_PASSWORD used when seeding the demo college>
After signing in, choose the "Invigilator" role if asked. Home lists the reviewer's upcoming exam duties; the Select tab shows exam rooms still open; tapping a duty shows details, confirmation and change requests. Alarms ring before each duty (allow notifications and alarms when asked).
```

The demo college is created by `backend/scripts/seed-demo-college.js` (see §6). Its data is separate from every
real college.

**Ads:** No, the app doesn't contain ads.

**Content rating:** fill in the IARC questionnaire.
- Category: *Utility, Productivity, Communication, or Other*
- Violence, sexual content, profanity, drugs, gambling: **No** to all
- Do users interact or exchange content? **Yes**: teachers message their college's exam cell
- Does the app share the user's location? **No**. Digital purchases? **No**

**Target audience:** **18 and over** only. The app isn't designed to appeal to children.

**News app:** No. **Government app:** No. **Financial features:** None. **Health:** None.

**Data safety:**

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all collected data encrypted in transit? | Yes |
| Do you provide a way for users to request that their data is deleted? | Yes: `https://proctavo.com/privacy#delete-account` |
| Account creation | The app doesn't let users create accounts. Accounts are created by the college; users sign in with email and password |
| Data **shared** with third parties | None (service providers acting for us don't count as sharing) |

Data **collected**. None of it is sold, shared or used for ads; it's all processed for the app's purpose only:

| Data type | Required? | Purposes |
|---|---|---|
| Personal info → Name | Required | App functionality, Account management |
| Personal info → Email address | Required | App functionality, Account management |
| Personal info → Phone number | Required (entered by the college) | App functionality, Account management |
| Personal info → User IDs | Required | App functionality, Account management |
| Personal info → Other info (department, designation) | Required | App functionality |
| Messages → Other in-app messages | Optional (only if the user writes to the exam cell) | App functionality |
| App activity → Other actions (duties selected, confirmed, swapped) | Required | App functionality |
| Device or other IDs (push-notification token) | Optional (only if notifications are allowed) | App functionality |

Not collected: location, contacts, photos/files, audio, calendar, health, financial info, web history, crash
logs or diagnostics, and advertising IDs.

**Permissions declarations:**
- **Full-screen intent (`USE_FULL_SCREEN_INTENT`):** declare the *alarm* use case. Justification:
  `Proctavo rings a scheduled alarm before each exam invigilation duty the user holds (by default 1 hour and 20 minutes before). The full-screen alarm lets the teacher snooze it or confirm "I'm on my way" from the lock screen, like an alarm clock.`
  If Google doesn't grant it automatically, the app already asks the user to switch it on in Settings. Without
  it the alarm still rings, as a heads-up notification.
- **Exact alarms (`SCHEDULE_EXACT_ALARM`):** no declaration needed. The user grants it, and the app asks.
- **Foreground service:** if Play Console asks, the app doesn't declare a foreground-service *type*; the
  permission comes from the notification library.

## 4. App signing (decide at the first upload)

Play re-signs what users download. Two options:

1. **Recommended: reuse the current key.** Pick *Use a different key → export and upload from a Java keystore*.
   The Play app then has the same signature as the APK on proctavo.com/app, so teachers who already installed
   it get the Play version as a normal update, and either source can update the other. It needs the Expo
   keystore exported with Google's PEPK tool (Java), a one-time step.
2. **Google-generated key** (Play's default). Nothing to export, but the Play app can't install over the
   sideloaded APK: those teachers uninstall once, then install from Play.

Whichever you choose, the AAB we upload is signed with the Expo keystore. With option 1 that's also the app-signing key.

## 5. Build and release

1. Build the bundle: `cd mobile && npx eas-cli build -p android --profile production` (an AAB; versionCode
   auto-increments). It needs `mobile/google-services.json` on the building machine (gitignored; see
   `mobile/README.md`).
2. Let OTA updates reach Play installs too: the production build listens on the `production` channel and we
   publish to `preview`, so point one at the other once:
   `npx eas-cli channel:edit production --branch preview`.
3. Play Console → **Testing → Internal testing** → create a release → upload the `.aab` → add testers' Gmail
   addresses → share the opt-in link. The first upload must be done by hand. Later ones can use
   `npx eas-cli submit -p android` with a Play service-account key.
4. **Closed testing** with 12+ testers for 14 days, then **Apply for production** (personal accounts).
5. Once public, switch the Android button on proctavo.com/app to the Play Store link.

## 6. Demo college and screenshots

1. After the deploy, on the server: `cd ~/exam-duty-new/backend && DEMO_PASSWORD='<choose one>' node scripts/seed-demo-college.js`.
   It creates "Proctavo Demo College" (code DEMO) with its own CS, teachers, rooms and an upcoming exam.
   The reviewer account already holds a few duties. Re-running it creates nothing new.
2. Sign in on a phone as `reviewer@demo.proctavo.com` and take the screenshots: Home (upcoming duties), a
   duty's detail, Select Duty, the alarm screen, Messages. Optionally sign in as `cs@demo.proctavo.com` for the
   CS home. Play needs PNG or JPEG, 16:9 or 9:16, with each side between 320 and 3840 px.
