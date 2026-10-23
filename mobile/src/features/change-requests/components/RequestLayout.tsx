import { useHeaderHeight } from "expo-router/react-navigation";
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Banner, Button, Text, TextField } from "@/components/ui";
import { Chip as FilterChip, SectionHeader } from "@/features/select-duty/components/ui";
import { dayKey, formatDate } from "@/features/select-duty/format";
import { sectionizeByWindow } from "@/features/select-duty/sections";
import { useTheme } from "@/theme";

import { SectionLabel } from "./parts";

/**
 * Page chrome for "request a change": scrollable body, keyboard-aware, with a
 * sticky submit bar. The body is the current duty, the target picker and the
 * reason; the bar names the chosen target so it's clear what gets sent.
 */
export function RequestLayout({
  children,
  refreshing,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          ) : undefined
        }>
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

export function SubmitBar({
  summary,
  disabled,
  submitting,
  onSubmit,
  error,
  title = "Submit request",
}: {
  summary: string | null;
  disabled: boolean;
  submitting: boolean;
  onSubmit: () => void;
  error: string | null;
  title?: string;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        gap: spacing.sm,
      }}>
      {error ? <Banner tone="danger" title={error} /> : null}
      <Text variant="caption" muted numberOfLines={2}>
        {summary ?? "Pick where you'd like to move to."}
      </Text>
      <Button title={title} icon="swap" size="lg" disabled={disabled} loading={submitting} onPress={onSubmit} />
    </View>
  );
}

/** Optional free-text reason; the web sends "No reason provided." when it's left empty. */
export function ReasonField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <TextField
      label="Reason (optional)"
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      multiline
      maxLength={500}
      textAlignVertical="top"
      style={{ minHeight: 72 }}
    />
  );
}

/**
 * Target picker body: day chips + date/time sections, like Select Duty. Item
 * order inside a window is preserved, so pass items already sorted.
 */
export function TargetSections<T>({
  title,
  items,
  windowOf,
  keyOf,
  renderItem,
  loading,
  error,
  emptyMessage,
}: {
  title: string;
  items: readonly T[];
  windowOf: (item: T) => { date: string; startTime: string; endTime: string };
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  loading: boolean;
  error: unknown;
  emptyMessage: string;
}) {
  const { colors, spacing } = useTheme();
  const [day, setDay] = useState<string | null>(null);

  const dayChips = useMemo(() => {
    const seen = new Map<string, string>();
    for (const it of items) {
      const w = windowOf(it);
      seen.set(dayKey(w.date), formatDate(w.date));
    }
    return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [items, windowOf]);

  const activeDay = day && dayChips.some(([k]) => k === day) ? day : null;
  const sections = useMemo(
    () => sectionizeByWindow(activeDay ? items.filter((it) => dayKey(windowOf(it).date) === activeDay) : items, windowOf),
    [items, windowOf, activeDay],
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel>{title}</SectionLabel>
      {loading ? (
        <Text muted>Loading…</Text>
      ) : error ? (
        <Banner tone="danger" title={error instanceof Error ? error.message : "Couldn't load options"}>
          <Text variant="caption" color={colors.danger}>
            Pull down to retry.
          </Text>
        </Banner>
      ) : items.length === 0 ? (
        <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 12, padding: spacing.lg }}>
          <Text muted style={{ textAlign: "center" }}>
            {emptyMessage}
          </Text>
        </View>
      ) : (
        <>
          {dayChips.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              <FilterChip label="All days" active={!activeDay} onPress={() => setDay(null)} />
              {dayChips.map(([k, label]) => (
                <FilterChip key={k} label={label} active={activeDay === k} onPress={() => setDay(k)} />
              ))}
            </ScrollView>
          ) : null}
          {sections.map((s) => (
            <View key={s.key}>
              <SectionHeader title={s.title} subtitle={s.subtitle} />
              {s.data.map((it) => (
                <View key={keyOf(it)}>{renderItem(it)}</View>
              ))}
            </View>
          ))}
        </>
      )}
    </View>
  );
}
