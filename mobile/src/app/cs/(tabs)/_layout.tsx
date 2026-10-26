import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useCsUnreadMessages } from "@/features/messages/hooks";
import { useAllChangeRequests } from "@/features/change-requests/hooks";
import { useTheme } from "@/theme";

const badge = (n: number) => (n > 99 ? "99+" : String(n));

/**
 * CS's tabs — a phone-sized slice of the web dashboard: Home (exam status),
 * Requests (approve / reject), Messages (chat with teachers), Settings. Alerts
 * open from the bell at the top right of each tab.
 */
export default function CsTabsLayout() {
  const { colors } = useTheme();
  const { data: unread = 0 } = useCsUnreadMessages();
  const pending = useAllChangeRequests("pending").data?.length ?? 0;

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
      <NativeTabs.Trigger name="requests">
        <NativeTabs.Trigger.Label>Requests</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.left.arrow.right" md="swap_horiz" />
        {pending > 0 ? <NativeTabs.Trigger.Badge>{badge(pending)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      {/* The chat sizes itself above the tab bar and keyboard (ChatScreen), so
          the automatic insets are off for this tab. */}
      <NativeTabs.Trigger name="messages" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Messages</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }}
          md="chat"
        />
        {unread > 0 ? <NativeTabs.Trigger.Badge>{badge(unread)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
