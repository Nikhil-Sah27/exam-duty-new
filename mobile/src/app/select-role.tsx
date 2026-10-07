import { useState } from "react";
import { View } from "react-native";

import { Banner, Button, Card, Icon, Logo, Screen, Text } from "@/components/ui";
import { chooseRole, signOut } from "@/features/auth/session";
import { ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { useAuthStore } from "@/store/auth";
import { roleColors, useTheme } from "@/theme";

const ROLE_HINTS: Record<UserRole, string> = {
  invigilator: "Single exam rooms",
  rs: "Groups of up to 5 rooms",
  dcs: "Supervise a DCS group",
  cs: "Admin — uses the web dashboard",
};

export default function SelectRoleScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (role: UserRole) => {
    setBusy(role);
    setError(null);
    try {
      await chooseRole(role);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't switch role");
    } finally {
      setBusy(null);
    }
  };

  const roles = user?.roles ?? [];
  return (
    <Screen edges={["top", "bottom"]}>
      <Logo size={36} />
      <View style={{ gap: 6 }}>
        <Text variant="heading">Hi {user?.name?.split(" ")[0] ?? "there"}, continue as…</Text>
        <Text muted>You hold more than one role. Alarms cover duties from all of them; the role you pick decides what you select and see.</Text>
      </View>
      {error ? <Banner tone="danger" title={error} /> : null}
      {roles.map((role) => {
        const accent = role === "cs" ? { fg: colors.textMuted, bg: colors.surfaceMuted } : roleColors[role];
        return (
          <Card key={role} onPress={busy ? undefined : () => pick(role)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ backgroundColor: accent.bg, borderRadius: 12, padding: 10 }}>
                <Icon name={role === "cs" ? "web" : "person"} size={22} color={accent.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{ROLE_LABELS[role]}</Text>
                <Text variant="caption" muted>
                  {ROLE_HINTS[role]}
                </Text>
              </View>
              {busy === role ? <Text muted>…</Text> : <Icon name="chevron" size={16} color={colors.textMuted} />}
            </View>
          </Card>
        );
      })}
      <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}
