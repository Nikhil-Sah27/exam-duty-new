import { forwardRef, useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/theme";

interface Props extends TextInputProps {
  label: string;
  icon?: IconName;
  secure?: boolean;
}

export const TextField = forwardRef<TextInput, Props>(function TextField({ label, icon, secure, style, ...rest }, ref) {
  const { colors, radius } = useTheme();
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" muted>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          minHeight: 50,
        }}
      >
        {icon ? <Icon name={icon} size={18} color={colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          style={[{ flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 }, style]}
          {...rest}
        />
        {secure ? (
          <Pressable accessibilityLabel={hidden ? "Show password" : "Hide password"} onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Icon name={hidden ? "eye" : "eyeOff"} size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});
