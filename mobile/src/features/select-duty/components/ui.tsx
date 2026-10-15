import { router } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing, useTheme, type ThemeColors } from "@/theme";

import type { CardState } from "../selection";

// ── State badge ──────────────────────────────────────────────────────────
// Teacher palette from the web legend: green = available, blue = selected,
// red = occupied / conflict. "Yours" uses the brand colour.

export function stateStyle(state: CardState, c: ThemeColors) {
  switch (state) {
    case "SELECTED":
      return { fg: c.info, bg: c.infoBg, border: c.info, label: "Selected" };
    case "MINE":
      return { fg: c.primary, bg: c.surfaceMuted, border: c.primary, label: "Yours" };
    case "FULL":
      return { fg: c.danger, bg: c.dangerBg, border: c.border, label: "Occupied" };
    case "CONFLICT":
      return { fg: c.danger, bg: c.dangerBg, border: c.border, label: "Time conflict" };
    default:
      return { fg: c.success, bg: c.successBg, border: c.border, label: "Available" };
  }
}

export function StateBadge({ state }: { state: CardState }) {
  const { colors } = useTheme();
  const s = stateStyle(state, colors);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>
        {state === "SELECTED" ? "✓ " : ""}
        {s.label}
      </Text>
    </View>
  );
}

// ── Selectable card shell ────────────────────────────────────────────────

export function SelectableCard({
  state,
  onPress,
  disabled,
  children,
  accessibilityLabel,
}: {
  state: CardState;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const s = stateStyle(state, colors);
  const dimmed = state === "FULL" || state === "CONFLICT";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: state === "SELECTED", disabled: disabled || dimmed }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: s.border,
          borderWidth: state === "SELECTED" || state === "MINE" ? 2 : 1,
          opacity: dimmed ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}>
      {children}
    </Pressable>
  );
}

// ── Chips ────────────────────────────────────────────────────────────────

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected: active }}
      hitSlop={6}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.surfaceMuted,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}>
      <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function SmallTag({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.tagText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ── Banners & states ─────────────────────────────────────────────────────

export function Notice({ tone, children }: { tone: "warning" | "danger" | "info"; children: ReactNode }) {
  const { colors } = useTheme();
  const map = {
    warning: { fg: colors.warning, bg: colors.warningBg },
    danger: { fg: colors.danger, bg: colors.dangerBg },
    info: { fg: colors.info, bg: colors.infoBg },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: map.bg }]}>
      <Text style={[styles.noticeText, { color: map.fg }]}>{children}</Text>
    </View>
  );
}

export function CenterState({
  title,
  message,
  loading,
  actionLabel,
  onAction,
}: {
  title?: string;
  message?: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      {loading && <ActivityIndicator color={colors.primary} />}
      {title && <Text style={[styles.centerTitle, { color: colors.text }]}>{title}</Text>}
      {message && <Text style={[styles.centerMessage, { color: colors.textMuted }]}>{message}</Text>}
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={[styles.outlineButton, { borderColor: colors.primary }]}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

// ── Screen header (stack screens render their own, so it works under any parent navigator) ──

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + spacing.sm, backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/select"))}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        style={styles.backButton}>
        <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ── Sticky claim bar ─────────────────────────────────────────────────────

export function ClaimBar({
  count,
  unit,
  pending,
  onClaim,
  onClear,
}: {
  count: number;
  unit: { one: string; many: string };
  pending: boolean;
  onClaim: () => void;
  onClear: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (count === 0) return null;
  return (
    <View
      style={[
        styles.claimBar,
        { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}>
      <Pressable onPress={onClear} disabled={pending} hitSlop={8} style={styles.clearButton}>
        <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Clear</Text>
      </Pressable>
      <Pressable
        onPress={onClaim}
        disabled={pending}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.claimButton,
          { backgroundColor: colors.primary, opacity: pending ? 0.6 : pressed ? 0.85 : 1 },
        ]}>
        {pending ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={[styles.claimText, { color: colors.onPrimary }]}>
            Claim {count} {count === 1 ? unit.one : unit.many}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export const cardStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  title: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  meta: { fontSize: 13, marginTop: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  hint: { fontSize: 12, marginTop: spacing.sm },
});

const styles = StyleSheet.create({
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: "700" },
  card: { borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md } as ViewStyle,
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  tagText: { fontSize: 12, fontWeight: "600" },
  notice: { borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md },
  noticeText: { fontSize: 13, lineHeight: 18 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl * 2, gap: spacing.sm },
  centerTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  centerMessage: { fontSize: 14, textAlign: "center", paddingHorizontal: spacing.xl },
  outlineButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionSubtitle: { fontSize: 13, marginTop: 2 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { paddingVertical: spacing.xs, paddingRight: spacing.sm },
  backText: { fontSize: 16, fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSubtitle: { fontSize: 13 },
  claimBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  clearButton: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  claimButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  claimText: { fontSize: 16, fontWeight: "700" },
});
