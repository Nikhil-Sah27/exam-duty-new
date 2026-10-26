import { StyleSheet, TextInput, View } from "react-native";

import { Icon } from "@/components/ui";
import { useTheme } from "@/theme";

/** The list-filter box at the top of the CS inbox and the new-chat picker. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
      <Icon name="search" size={16} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text }]}
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15 },
});
