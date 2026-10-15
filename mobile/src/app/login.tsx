import { Link } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";

import { Banner, Button, Logo, Screen, Text, TextField } from "@/components/ui";
import { login } from "@/features/auth/api";
import { completeLogin } from "@/features/auth/session";
import { useTheme } from "@/theme";

export default function LoginScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await completeLogin(await login(email, password));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Screen edges={["top", "bottom"]} contentStyle={{ flexGrow: 1, justifyContent: "center", gap: 28 }}>
        <View style={{ gap: 14 }}>
          <Logo size={48} />
          <Text variant="title">Your exam duties, on your phone</Text>
          <Text muted>
            {"Sign in with your Proctavo account. You'll get an alert for every duty change and an alarm before each duty."}
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          {error ? <Banner tone="danger" title={error} /> : null}
          <TextField
            label="Email"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="you@college.edu"
          />
          <TextField
            ref={passwordRef}
            label="Password"
            icon="lock"
            secure
            value={password}
            onChangeText={setPassword}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            placeholder="Password"
          />
          <Button title="Sign in" size="lg" onPress={submit} loading={busy} />
          <Link href="/forgot-password" asChild>
            <Pressable hitSlop={8} style={{ alignSelf: "center", paddingVertical: 6 }}>
              <Text variant="label" color={colors.primary}>
                Forgot password?
              </Text>
            </Pressable>
          </Link>
        </View>

        <Text variant="caption" muted style={{ textAlign: "center" }}>
          For Invigilators, RS and DCS. CS manages exams on the web dashboard.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
