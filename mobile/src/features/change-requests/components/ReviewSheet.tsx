import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";

import { Banner, Button, Text, TextField } from "@/components/ui";
import { useTheme } from "@/theme";

/**
 * Approve / reject one change request with an optional note to the requester
 * (port of the web ReviewActions modal). `action` null = closed. Give it a
 * `key` per request so each opening starts with an empty note.
 */
export function ReviewSheet({
  action,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  action: "approve" | "reject" | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const { colors, radius } = useTheme();
  const [note, setNote] = useState("");

  const approve = action === "approve";
  return (
    <Modal visible={action !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
          <Text variant="heading">{approve ? "Approve request" : "Reject request"}</Text>
          <TextField
            label="Note to the teacher (optional)"
            value={note}
            onChangeText={setNote}
            placeholder={approve ? "e.g. Approved — report to Block A" : "e.g. No replacement available that day"}
            multiline
          />
          {error ? <Banner tone="danger" title={error} /> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button
              title={approve ? "Approve" : "Reject"}
              variant={approve ? "success" : "danger"}
              icon={approve ? "check" : "close"}
              loading={busy}
              onPress={() => onConfirm(note.trim())}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { padding: 20, gap: 14 },
});
