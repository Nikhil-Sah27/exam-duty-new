import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

// One name per concept, mapped to SF Symbols (iOS) and Material Symbols (Android).
const ICONS = {
  home: { ios: "house.fill", android: "home" },
  select: { ios: "plus.rectangle.on.rectangle", android: "add_task" },
  alerts: { ios: "bell.fill", android: "notifications" },
  settings: { ios: "gearshape.fill", android: "settings" },
  alarm: { ios: "alarm.fill", android: "alarm" },
  alarmOn: { ios: "alarm.waves.left.and.right.fill", android: "alarm_on" },
  alarmOff: { ios: "alarm", android: "alarm_off" },
  calendar: { ios: "calendar", android: "calendar_month" },
  clock: { ios: "clock.fill", android: "schedule" },
  location: { ios: "mappin.and.ellipse", android: "location_on" },
  building: { ios: "building.2.fill", android: "apartment" },
  room: { ios: "door.left.hand.open", android: "meeting_room" },
  check: { ios: "checkmark.circle.fill", android: "check_circle" },
  confirm: { ios: "hand.thumbsup.fill", android: "how_to_reg" },
  logout: { ios: "rectangle.portrait.and.arrow.right", android: "logout" },
  swap: { ios: "arrow.left.arrow.right", android: "swap_horiz" },
  external: { ios: "arrow.up.right.square", android: "open_in_new" },
  refresh: { ios: "arrow.clockwise", android: "refresh" },
  error: { ios: "exclamationmark.octagon.fill", android: "error" },
  warning: { ios: "exclamationmark.triangle.fill", android: "warning" },
  battery: { ios: "battery.25", android: "battery_alert" },
  bellRing: { ios: "bell.badge.fill", android: "notifications_active" },
  person: { ios: "person.crop.circle.fill", android: "person" },
  lock: { ios: "lock.fill", android: "lock" },
  mail: { ios: "envelope.fill", android: "mail" },
  back: { ios: "chevron.left", android: "arrow_back" },
  chevron: { ios: "chevron.right", android: "chevron_right" },
  snooze: { ios: "zzz", android: "snooze" },
  walk: { ios: "figure.walk", android: "directions_walk" },
  close: { ios: "xmark", android: "close" },
  doneAll: { ios: "checkmark.circle", android: "done_all" },
  eye: { ios: "eye", android: "visibility" },
  eyeOff: { ios: "eye.slash", android: "visibility_off" },
  info: { ios: "info.circle.fill", android: "info" },
  web: { ios: "globe", android: "language" },
  chat: { ios: "bubble.left.and.bubble.right.fill", android: "chat" },
  key: { ios: "key.fill", android: "key" },
  volumeOff: { ios: "speaker.slash.fill", android: "volume_off" },
  volumeUp: { ios: "speaker.wave.3.fill", android: "volume_up" },
} as const satisfies Record<string, { ios: string; android: string }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  return <SymbolView name={ICONS[name] as SymbolName} size={size} tintColor={color} />;
}
