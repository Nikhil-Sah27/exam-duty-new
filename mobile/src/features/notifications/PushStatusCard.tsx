import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, View } from "react-native";

import { Button, Card, Icon, Text } from "@/components/ui";
import { ensureNotificationPermission, registerForPush } from "@/push";
import { useTheme } from "@/theme";

/**
 * Whether this phone may show Proctavo's notifications, with a one-tap fix —
 * for roles without the alarm health check (CS), whose main phone signal is a
 * teacher's message.
 */
export function PushStatusCard() {
  const { colors } = useTheme();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [canAsk, setCanAsk] = useState(true);

  const refresh = useCallback(() => {
    void Notifications.getPermissionsAsync().then((p) => {
      setGranted(p.granted);
      setCanAsk(p.canAskAgain);
    });
  }, []);
  // Re-check whenever the tab is shown — e.g. after returning from system settings.
  useFocusEffect(refresh);

  const fix = async () => {
    if (!canAsk) {
      await Linking.openSettings();
      return;
    }
    if (await ensureNotificationPermission()) await registerForPush();
    refresh();
  };

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Icon name={granted ? "check" : "error"} size={20} color={granted ? colors.success : colors.danger} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" style={{ fontWeight: "600" }}>
            Phone notifications
          </Text>
          <Text variant="caption" muted>
            {granted
              ? "On — teachers' messages and alerts show on this phone."
              : "Off — you won't hear about teachers' messages until you allow notifications."}
          </Text>
        </View>
        {granted === false ? <Button title={canAsk ? "Allow" : "Settings"} variant="secondary" onPress={() => void fix()} /> : null}
      </View>
    </Card>
  );
}
