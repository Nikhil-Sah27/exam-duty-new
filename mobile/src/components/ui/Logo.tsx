import { Image } from "expo-image";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";

/** Proctavo mark + wordmark, drawn as text so it follows the theme. */
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image source={require("@/assets/images/logo-mark.png")} style={{ width: size, height: size }} contentFit="contain" />
      <Text style={{ fontSize: size * 0.6, fontWeight: "800", letterSpacing: -0.5 }}>Proctavo</Text>
    </View>
  );
}
