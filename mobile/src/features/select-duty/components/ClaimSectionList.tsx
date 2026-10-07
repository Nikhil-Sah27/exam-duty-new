import type { ReactElement, ReactNode } from "react";
import { RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native";

import { spacing, useTheme } from "@/theme";

import type { TimeSection } from "../sections";
import { CenterState, Chip, Notice, SectionHeader } from "./ui";

export interface DayChip {
  key: string;
  label: string;
}

/**
 * Shared list chrome for the three role screens: date chips + "Available only"
 * filter, the conflict banner, date/time sections, pull-to-refresh, and the
 * sticky claim bar underneath.
 */
export function ClaimSectionList<T>({
  sections,
  keyOf,
  renderCard,
  dayChips,
  activeDay,
  onDay,
  availableOnly,
  onToggleAvailableOnly,
  banner,
  notice,
  refreshing,
  onRefresh,
  loading,
  error,
  onRetry,
  emptyMessage,
  footer,
}: {
  sections: TimeSection<T>[];
  keyOf: (item: T) => string;
  renderCard: (item: T) => ReactElement;
  dayChips: DayChip[];
  activeDay: string | null;
  onDay: (key: string | null) => void;
  availableOnly: boolean;
  onToggleAvailableOnly: () => void;
  banner: string | null;
  notice?: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  emptyMessage: string;
  footer: ReactNode;
}) {
  const { colors } = useTheme();

  const header = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroller}>
        <Chip label="All days" active={activeDay === null} onPress={() => onDay(null)} />
        {dayChips.map((d) => (
          <Chip key={d.key} label={d.label} active={activeDay === d.key} onPress={() => onDay(d.key)} />
        ))}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Chip label="Available only" active={availableOnly} onPress={onToggleAvailableOnly} />
      </ScrollView>
      {notice}
      {banner ? <Notice tone="warning">{banner}</Notice> : null}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <CenterState loading message="Loading…" />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={keyOf}
        renderItem={({ item }) => renderCard(item)}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} subtitle={section.subtitle} />}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          error ? (
            <CenterState
              title="Couldn't load duties"
              message={error instanceof Error ? error.message : "Please try again."}
              actionLabel="Retry"
              onAction={onRetry}
            />
          ) : (
            <CenterState title="Nothing here" message={emptyMessage} />
          )
        }
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  chipScroller: { marginHorizontal: -spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  divider: { width: 1, height: 24, marginHorizontal: spacing.xs },
});
