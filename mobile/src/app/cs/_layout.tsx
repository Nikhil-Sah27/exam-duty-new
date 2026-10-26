import { Stack } from "expo-router";

// CS's part of the app (/cs/...): its own tabs — see (tabs)/_layout.tsx.
export default function CsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
