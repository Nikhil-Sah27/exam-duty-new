import type { RefObject } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Icon, Text, type IconName } from "@/components/ui";
import { useTheme } from "@/theme";

import type { ChatMessage } from "../api";
import { MAX_MESSAGE_LENGTH, senderLabel } from "../format";
import { EmojiPicker } from "./EmojiPicker";

interface Props {
  inputRef: RefObject<TextInput | null>;
  text: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  editing: ChatMessage | null;
  onCancelEdit: () => void;
  pickerOpen: boolean;
  onTogglePicker: (open: boolean) => void;
  /** Space under the input row: the keyboard overlap, or the bottom safe area. */
  bottomInset: number;
  disabled?: boolean;
}

function ContextBanner({
  icon,
  title,
  body,
  fg,
  bg,
  onCancel,
  cancelLabel,
}: {
  icon: IconName;
  title: string;
  body: string;
  fg: string;
  bg: string;
  onCancel: () => void;
  cancelLabel: string;
}) {
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderLeftColor: fg }]}>
      <Icon name={icon} size={16} color={fg} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="caption" color={fg} style={{ fontWeight: "700" }}>
          {title}
        </Text>
        <Text variant="caption" color={fg} numberOfLines={1} style={{ opacity: 0.85 }}>
          {body}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={onCancel} hitSlop={10} style={styles.bannerClose}>
        <Icon name="close" size={16} color={fg} />
      </Pressable>
    </View>
  );
}

/** Composer with reply / edit context banners and an emoji picker (web MessageComposer). */
export function MessageComposer({
  inputRef,
  text,
  onChangeText,
  onSubmit,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  pickerOpen,
  onTogglePicker,
  bottomInset,
  disabled,
}: Props) {
  const { colors } = useTheme();
  const canSend = !disabled && !!text.trim();

  const togglePicker = () => {
    if (pickerOpen) {
      onTogglePicker(false);
      inputRef.current?.focus();
    } else {
      Keyboard.dismiss(); // the grid takes the keyboard's place, as on most chat apps
      onTogglePicker(true);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: pickerOpen ? 0 : bottomInset }]}>
      {/* Editing takes priority over replying, as on the web. */}
      {editing ? (
        <ContextBanner
          icon="edit"
          title="Editing message"
          body={editing.body}
          fg={colors.warning}
          bg={colors.warningBg}
          onCancel={onCancelEdit}
          cancelLabel="Cancel edit"
        />
      ) : replyTo ? (
        <ContextBanner
          icon="reply"
          title={`Replying to ${senderLabel(replyTo)}`}
          body={replyTo.body}
          fg={colors.info}
          bg={colors.infoBg}
          onCancel={onCancelReply}
          cancelLabel="Cancel reply"
        />
      ) : null}

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pickerOpen ? "Show keyboard" : "Insert emoji"}
          onPress={togglePicker}
          style={[styles.iconBtn, pickerOpen && { backgroundColor: colors.surfaceMuted }]}
        >
          <Icon name={pickerOpen ? "keyboard" : "emoji"} size={22} color={pickerOpen ? colors.primary : colors.textMuted} />
        </Pressable>

        <View style={[styles.field, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={onChangeText}
            onFocus={() => pickerOpen && onTogglePicker(false)}
            placeholder="Type a message…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            editable={!disabled}
            textAlignVertical="center"
            style={[styles.input, { color: colors.text }]}
            accessibilityLabel={editing ? "Edit message" : "Message"}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? "Save edit" : "Send message"}
          accessibilityState={{ disabled: !canSend }}
          onPress={canSend ? onSubmit : undefined}
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: canSend ? colors.primaryDeep : colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Icon name={editing ? "tick" : "send"} size={20} color={canSend ? colors.onPrimary : colors.textMuted} />
        </Pressable>
      </View>

      {pickerOpen ? (
        <View style={{ paddingBottom: bottomInset }}>
          <EmojiPicker
            onPick={(e) => {
              onChangeText(text + e);
              onTogglePicker(false);
              inputRef.current?.focus();
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderLeftWidth: 4, paddingHorizontal: 12, paddingVertical: 8 },
  bannerClose: { padding: 4 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  field: { flex: 1, borderWidth: 1, borderRadius: 21, paddingHorizontal: 14, minHeight: 42, justifyContent: "center" },
  input: { fontSize: 16, maxHeight: 120, paddingTop: 10, paddingBottom: 10 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
