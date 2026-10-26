import * as Application from "expo-application";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Button, Card, Divider, ListRow, Text } from "@/components/ui";
import { API_URL } from "@/lib/config";
import { isTeacherRole, ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

import { chooseRole, signOut } from "./session";

const switchHint = (role: UserRole) =>
  isTeacherRole(role) ? "Alarms stay on for all your duties" : role === "cs" ? "Exam cell: dashboard, requests, messages" : "Opens the web dashboard";

/** Settings' account section, for every role: who's signed in, switch role, sign out. */
export function AccountCard({ signOutWarning }: { signOutWarning: string }) {
  const user = useAuthStore((s) => s.user);
  const [switching, setSwitching] = useState(false);

  const otherRoles = (user?.roles ?? []).filter((r): r is UserRole => r !== user?.activeRole);
  const switchTo = (role: UserRole) => {
    setSwitching(true);
    chooseRole(role)
      .catch((e: unknown) => Alert.alert("Couldn't switch role", e instanceof Error ? e.message : String(e)))
      .finally(() => setSwitching(false));
  };

  const confirmSignOut = () =>
    Alert.alert("Sign out?", signOutWarning, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <Card>
      <Text variant="subheading">Account</Text>
      <ListRow icon="person" title={user?.name ?? ""} subtitle={user?.email} />
      {user?.activeRole ? <ListRow icon="info" title="Current role" subtitle={ROLE_LABELS[user.activeRole]} /> : null}
      {otherRoles.length > 0 ? (
        <>
          <Divider />
          {otherRoles.map((r) => (
            <ListRow
              key={r}
              icon="swap"
              title={`Switch to ${ROLE_LABELS[r]}`}
              subtitle={switchHint(r)}
              chevron
              onPress={switching ? undefined : () => switchTo(r)}
            />
          ))}
        </>
      ) : null}
      <Divider />
      <Button title="Sign out" variant="danger" icon="logout" onPress={confirmSignOut} />
    </Card>
  );
}

/** The app version + server line at the foot of Settings. */
export function AppVersionNote() {
  return (
    <View>
      <Text variant="caption" muted style={{ textAlign: "center" }}>
        Proctavo {Application.nativeApplicationVersion ?? ""} ({Application.nativeBuildVersion ?? "dev"}) · {API_URL.replace(/^https?:\/\//, "")}
      </Text>
    </View>
  );
}
