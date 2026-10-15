import { useState } from "react";
import { View } from "react-native";

import { playSoundCheck, soundAdvice, useSoundStatus } from "@/alarms";
import { Banner, Button, Text } from "@/components/ui";
import { useTheme } from "@/theme";

/**
 * "Your phone is on silent" / "Your alarm volume is off" — shown on Home while
 * the teacher has alarms coming, and only when it actually matters (see
 * soundAdvice). Renders nothing when alarms will be heard or we can't tell.
 */
export function SoundCheckBanner() {
  const { colors } = useTheme();
  const advice = soundAdvice(useSoundStatus());
  const [fixing, setFixing] = useState(false);
  if (!advice) return null;

  const fg = advice.tone === "danger" ? colors.danger : colors.warning;
  return (
    <Banner tone={advice.tone} icon="volumeOff" title={advice.title}>
      <Text variant="caption" color={fg}>
        {advice.message}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
        {advice.fix ? (
          <Button
            title={advice.fix.label}
            icon="volumeUp"
            variant="secondary"
            loading={fixing}
            onPress={() => {
              setFixing(true);
              void advice.fix?.run().finally(() => setFixing(false));
            }}
          />
        ) : null}
        <Button title="Play alarm sound" icon="bellRing" variant="secondary" onPress={() => void playSoundCheck()} />
      </View>
    </Banner>
  );
}
