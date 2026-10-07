import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";

import { Banner, Button, Screen, Text, TextField } from "@/components/ui";
import { requestPasswordReset, resetPassword } from "@/features/auth/api";

/** Two-step OTP reset: email a 6-digit code, then set a new password with it. */
export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      if (!email.trim()) throw new Error("Enter your email.");
      await requestPasswordReset(email);
      setNotice("If that email is registered, a 6-digit code is on its way. It expires in 10 minutes.");
      setStep("code");
    });

  const reset = () =>
    run(async () => {
      if (otp.trim().length !== 6) throw new Error("Enter the 6-digit code from the email.");
      if (password.length < 6) throw new Error("The new password needs at least 6 characters.");
      await resetPassword(email, otp, password);
      setNotice(null);
      router.replace("/login");
    });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Screen edges={["bottom"]}>
        <Text muted>
          {step === "email"
            ? "Enter the email you sign in with. We'll send you a one-time code."
            : `Enter the code sent to ${email.trim()} and choose a new password.`}
        </Text>
        {error ? <Banner tone="danger" title={error} /> : null}
        {notice ? <Banner tone="info" title={notice} /> : null}

        {step === "email" ? (
          <View style={{ gap: 16 }}>
            <TextField
              label="Email"
              icon="mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onSubmitEditing={sendCode}
            />
            <Button title="Send code" size="lg" onPress={sendCode} loading={busy} />
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <TextField
              label="6-digit code"
              icon="key"
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
            <TextField label="New password" icon="lock" secure value={password} onChangeText={setPassword} autoComplete="new-password" />
            <Button title="Set new password" size="lg" onPress={reset} loading={busy} />
            <Button title="Send a new code" variant="ghost" onPress={sendCode} disabled={busy} />
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
