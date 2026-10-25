import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useUnreadMessages } from "@/features/messages/hooks";
import { useTheme } from "@/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { data: unreadMessages = 0 } = useUnreadMessages();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.surfaceMuted}
      tintColor={colors.primary}
      labelStyle={{ selected: { color: colors.primary } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="select">
        <NativeTabs.Trigger.Label>Select Duty</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="plus.rectangle.on.rectangle" md="add_task" />
      </NativeTabs.Trigger>
      {/* Alerts moved to the bell at the top right of each tab (AlertsBell).
          The chat sizes itself above the tab bar and keyboard (MessagesScreen),
          so the automatic insets are off for this tab. */}
      <NativeTabs.Trigger name="messages" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Messages</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }}
          md="chat"
        />
        {unreadMessages > 0 ? (
          <NativeTabs.Trigger.Badge>{unreadMessages > 99 ? "99+" : String(unreadMessages)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
