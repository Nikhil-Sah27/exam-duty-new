import { Screen, Text } from "@/components/ui";
import { AccountCard, AppVersionNote } from "@/features/auth/AccountCard";
import { PushStatusCard } from "@/features/notifications/PushStatusCard";
import { TabHeader } from "@/features/notifications/TabHeader";

/** CS Settings: phone-notification status, account (switch role / sign out), version. */
export default function CsSettingsScreen() {
  return (
    <Screen>
      <TabHeader>
        <Text variant="title">Settings</Text>
      </TabHeader>
      <PushStatusCard />
      <AccountCard signOutWarning="This phone will stop getting your message alerts until you sign in again." />
      <AppVersionNote />
    </Screen>
  );
}
