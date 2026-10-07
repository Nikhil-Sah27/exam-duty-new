// Custom entry: the Android alarm library delivers action presses (Dismiss /
// Snooze / I'm on my way) to a background handler that must be registered
// before the app component, even when the app was killed.
import { registerAlarmBackgroundHandler } from "@/alarms/events";

registerAlarmBackgroundHandler();

import "expo-router/entry";
