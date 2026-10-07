// Autolinking overrides (read by Expo autolinking during prebuild).
//
// - react-native-notify-kit is the ANDROID alarm engine only. On iOS it would
//   install itself as the UNUserNotificationCenter delegate and fight
//   expo-notifications over push taps, so it is not linked there.
// - AlarmKit (iOS 26+) has no Android counterpart; its Nitro module and runtime
//   are left out of the Android build entirely.
module.exports = {
  dependencies: {
    "react-native-notify-kit": { platforms: { ios: null } },
    "react-native-nitro-ios-alarm-kit": { platforms: { android: null } },
    "react-native-nitro-modules": { platforms: { android: null } },
  },
};
