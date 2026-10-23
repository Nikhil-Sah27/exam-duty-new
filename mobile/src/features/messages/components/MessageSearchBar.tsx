import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Icon, Text, type IconName } from "@/components/ui";
import { useTheme } from "@/theme";

interface Props {
  term: string;
  onChangeTerm: (t: string) => void;
  /** 0-based index of the highlighted match, and how many there are. */
  active: number;
  total: number;
  onStep: (dir: 1 | -1) => void;
  onClose: () => void;
}

function Btn({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={20} color={colors.textMuted} />
    </Pressable>
  );
}

/** In-chat search (web MessageThread search row): match counter + previous / next. */
export function MessageSearchBar({ term, onChangeTerm, active, total, onStep, onClose }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Icon name="search" size={18} color={colors.textMuted} />
      <TextInput
        autoFocus
        value={term}
        onChangeText={onChangeTerm}
        placeholder="Search in conversation"
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        onSubmitEditing={() => onStep(1)}
        autoCorrect={false}
        style={[styles.input, { color: colors.text }]}
        accessibilityLabel="Search in conversation"
      />
      {term ? (
        <Text variant="caption" muted style={{ fontVariant: ["tabular-nums"] }}>
          {total ? active + 1 : 0}/{total}
        </Text>
      ) : null}
      <Btn icon="chevronUp" label="Previous match" onPress={() => onStep(-1)} disabled={!total} />
      <Btn icon="chevronDown" label="Next match" onPress={() => onStep(1)} disabled={!total} />
      <Btn icon="close" label="Close search" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  btn: { padding: 4 },
});
