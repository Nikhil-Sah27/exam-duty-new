import type { ReactNode } from "react";
import { View } from "react-native";

import { Chip, Icon, Text, type IconName } from "@/components/ui";
import { SmallTag } from "@/features/select-duty/components/ui";
import { formatClock, formatExamDate } from "@/lib/format";
import { useTheme } from "@/theme";

import type { ChangeRequestStatus } from "../types";

export { SmallTag };

/** "Mon, 12 Oct · 9:30 AM – 12:30 PM" */
export const whenLabel = (date: string, start: string, end: string) =>
  `${formatExamDate(date)} · ${formatClock(start)} – ${formatClock(end)}`;

/** "SEE · Sem 5", or whatever part of it is known. */
export const examLabel = (examType: string | null | undefined, semester: number | string | null | undefined) =>
  [examType && examType !== "—" ? examType : null, semester != null && semester !== "—" ? `Sem ${semester}` : null]
    .filter(Boolean)
    .join(" · ");

export function InfoLine({ icon, children, strong }: { icon: IconName; children: ReactNode; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name={icon} size={15} color={colors.textMuted} />
      <Text muted={!strong} style={[{ flex: 1 }, strong ? { fontWeight: "600" } : null]}>
        {children}
      </Text>
    </View>
  );
}

export function TagRow({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      {labels.map((l, i) => (
        <SmallTag key={`${l}-${i}`} label={l} />
      ))}
    </View>
  );
}

/** Small uppercase heading used for "Current" / "Requested" and list sections. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" muted style={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" }}>
      {children}
    </Text>
  );
}

export function StatusChip({ status }: { status: ChangeRequestStatus }) {
  const { colors } = useTheme();
  const map: Record<ChangeRequestStatus, { label: string; fg: string; bg: string }> = {
    pending: { label: "Pending", fg: colors.warning, bg: colors.warningBg },
    approved: { label: "Approved", fg: colors.success, bg: colors.successBg },
    rejected: { label: "Rejected", fg: colors.danger, bg: colors.dangerBg },
    cancelled_exam_deleted: { label: "Cancelled", fg: colors.textMuted, bg: colors.surfaceMuted },
  };
  const s = map[status] ?? map.pending;
  return <Chip label={s.label} fg={s.fg} bg={s.bg} />;
}

/** Tinted inner panel ("Current" / "Requested" blocks, the reason, CS's note). */
export function Panel({ children, tone }: { children: ReactNode; tone?: "success" | "danger" | "muted" }) {
  const { colors, radius } = useTheme();
  const bg = tone === "success" ? colors.successBg : tone === "danger" ? colors.dangerBg : colors.surfaceMuted;
  return <View style={{ backgroundColor: bg, borderRadius: radius.md, padding: 12, gap: 6 }}>{children}</View>;
}
