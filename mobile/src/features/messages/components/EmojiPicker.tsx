import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { EMOJI_PALETTE } from "../format";

/** The composer's emoji grid (same palette as the web), shown in place of the keyboard. */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.grid, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {EMOJI_PALETTE.map((e) => (
        <Pressable
          key={e}
          accessibilityRole="button"
          accessibilityLabel={`Insert ${e}`}
          onPress={() => onPick(e)}
          style={({ pressed }) => [styles.cell, pressed && { backgroundColor: colors.surfaceMuted }]}
        >
          <Text style={styles.emoji}>{e}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  cell: { width: "12.5%", height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  emoji: { fontSize: 24, lineHeight: 30 },
});
