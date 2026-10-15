import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";

import { Button, EmptyState, Logo, Screen } from "@/components/ui";
import { chooseRole, signOut } from "@/features/auth/session";
import { WEB_URL } from "@/lib/config";
import { isTeacherRole } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";

/** CS is the admin role — it lives on the web dashboard, not in this app. */
export default function CsWebScreen() {
  const user = useAuthStore((s) => s.user);
  const teacherRole = user?.roles.find(isTeacherRole);
  return (
    <Screen edges={["top", "bottom"]} contentStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <Logo size={36} />
      <EmptyState
        icon="web"
        title="CS uses the web dashboard"
        message="Creating exams, assigning duties and reports live on proctavo.com. This app is for Invigilators, RS and DCS."
      />
      <View style={{ gap: 12 }}>
        <Button title="Open proctavo.com" icon="external" size="lg" onPress={() => void WebBrowser.openBrowserAsync(WEB_URL)} />
        {teacherRole ? (
          <Button title="Continue with my teacher role" variant="secondary" icon="swap" onPress={() => void chooseRole(teacherRole)} />
        ) : null}
        <Button title="Sign out" variant="ghost" icon="logout" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
