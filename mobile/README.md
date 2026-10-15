# Proctavo mobile

The phone app for **Invigilators, RS and DCS**: duty alerts pushed to the lock screen, and an
**alarm that rings before every duty**. CS keeps using the web dashboard. Plan and decisions:
[`../MOBILE_PLAN.md`](../MOBILE_PLAN.md). Before touching any Expo API read [`AGENTS.md`](AGENTS.md):
this is Expo SDK 57, so check the versioned docs rather than relying on memory.

## What's in here

| Path | What |
|---|---|
| `src/app/` | Expo Router screens: `login`, `forgot-password`, `select-role`, `cs-web`, `(tabs)/{index,select,alerts,settings}`, `duty/[key]`, `alarm`, `select/[examGroupId]` |
| `src/alarms/` | On-device alarm engine. `syncAlarms()` reconciles scheduled alarms with `GET /api/duties/my-units` × the teacher's alarm settings |
| `src/push/` | Expo push token → `POST /api/push/devices`; `DELETE` on logout |
| `src/runtime/` | Teacher-only wiring: sync on foreground and on every push, notification tap routing, alarm screen routing |
| `src/features/` | API + hooks per domain (`auth`, `duties`, `notifications`, `select-duty`) |
| `plugins/withAlarmLockScreen.js` | Lets only a ringing alarm show over the Android lock screen |
| `react-native.config.js` | notify-kit is linked on Android only, AlarmKit on iOS only |

### How the alarm rings

| | Engine | Behaviour |
|---|---|---|
| Android | `react-native-notify-kit` (maintained Notifee fork) | `AlarmManager` alarm-clock trigger; `duty-alarm` channel with `USAGE_ALARM` audio, so it plays on the alarm stream even when the ringer is on silent; DND bypass; looping sound for up to 10 min; full-screen over the lock screen; **Dismiss / Snooze 5 min / I'm on my way** (that last button confirms the duty) |
| iOS 26+ | AlarmKit (`react-native-nitro-ios-alarm-kit`) | System alarm UI, rings through silent mode and Focus |
| iOS < 26 | `expo-notifications` | Time-sensitive notification with the alarm sound (≤30 s). It **can't** ring in silent mode |

Default lead times are **1 h and 20 min before start**. Teachers can change them in Settings, where
they can also send a test alarm and run a permissions health check.

Server pushes come from the backend `push` module on channel `duty-alerts`. Each push triggers an
alarm re-sync, so a cancelled duty loses its alarm. If a stale alarm still fires, the alarm screen
re-checks the duty and shows *"This duty was cancelled"*.

## Run it

A **development build** is required. Expo Go can't load the alarm and push native modules.

```bash
cd mobile
npm install

# Android, on a USB phone or emulator. Needs Android Studio's bundled JDK:
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
npx expo run:android            # prebuilds android/ (git-ignored), builds, installs, starts Metro

# Later sessions (app already installed):
npm start                       # Metro for the dev client

# iOS: there's no Xcode on this Mac, so build in the cloud (see EAS below)
```

The API defaults to production, `https://proctavo.com/api`. To point the app at a local backend,
use your Mac's LAN IP. A phone can't reach `localhost`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:5050/api npx expo start --dev-client
```

Checks (run before calling work done):

```bash
npx tsc --noEmit && npx expo lint && npx expo-doctor
```

Nothing in CI builds or checks `mobile/`, and the server deploy ignores it.

## Build & ship (EAS)

```bash
npx eas-cli@latest login
npx eas-cli@latest init                                     # writes extra.eas.projectId into app.json (push needs it)
npx eas-cli@latest build -p android --profile preview      # installable APK link for testers
npx eas-cli@latest build -p ios --profile preview          # internal iPhone build (registered devices)
npx eas-cli@latest build -p all --profile production       # store builds
npx eas-cli@latest submit -p ios                            # → TestFlight / App Store
```

Profiles are in `eas.json`. `development` is the dev client, `preview` is an internal APK or IPA, and
`production` is the store build. All three point at `https://proctavo.com/api`.

Local Android release without EAS:
`cd android && ./gradlew assembleRelease`. Run `npx expo prebuild -p android` first and set up a
signing key.

## Credentials checklist

| Need | Why | Where it goes |
|---|---|---|
| **Expo account** | Cloud builds and the push service | `eas login`, then `eas init` (sets `projectId`) |
| **Firebase project** | Android push delivery (FCM v1) | Put `google-services.json` in `mobile/` and set `"android.googleServicesFile": "./google-services.json"` in `app.json`. Upload the FCM v1 service-account key with `eas credentials` |
| **Apple Developer Program** ($99/yr) | Any iPhone install beyond a simulator, APNs, App Store | `eas credentials` creates certificates and the APNs key. Enable *Time Sensitive Notifications* on the App ID (EAS syncs the entitlement) |
| Google Play Console ($25 once, optional) | Play Store listing. The APK link works without it | `eas submit -p android` |
| Backend `.env`: `PUSH_TRANSPORT=expo` | Turns on real pushes (default `console` only logs) | server |

Until `projectId` and the Firebase file exist, the app still works fully, **including local alarms**.
Push registration just logs a warning and skips.

## Gotchas

- **Never edit `android/` or `ios/`.** They're generated and git-ignored. Native behaviour lives in
  `app.json`, `react-native.config.js` and `plugins/`. Re-run `npx expo prebuild --clean` after
  changing any of them.
- **Android channels are immutable once created.** If you change `duty-alarm`'s sound or importance
  in `src/alarms/native.ts`, rename the channel id, or already-installed phones keep the old settings.
- **Google Play restricts full-screen intents.** Only alarm and calling apps get them, so declare
  the duty-alarm use case in the Play listing. Without that access the alarm still rings, loops and
  shows its buttons, as a heads-up notification instead.
- **Battery savers on Xiaomi, Oppo, Vivo and Realme phones can delay pushes.** Settings → *Will my
  alarm ring?* links to the right system screens. Alarm-clock alarms themselves are the most
  resilient thing Android offers.
