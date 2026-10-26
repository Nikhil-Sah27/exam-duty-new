import { View } from "react-native";

import { Card, Text } from "@/components/ui";
import type { ExamGroup } from "@/features/select-duty/shared/examTypes";
import { examTitle, formatExamDate } from "@/lib/format";

/** One titled list of exams (Ongoing / Upcoming), nothing when empty. */
export function ExamList({ title, exams }: { title: string; exams: ExamGroup[] }) {
  if (exams.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text variant="heading">{title}</Text>
      {exams.map((g) => (
        <Card key={g._id}>
          <View style={{ gap: 2 }}>
            <Text variant="body" style={{ fontWeight: "700" }}>
              {examTitle(g.examType, g.semester)}
            </Text>
            <Text variant="caption" muted>
              {formatExamDate(g.startDate)} – {formatExamDate(g.endDate)} · {g.totalRooms}{" "}
              {g.totalRooms === 1 ? "room" : "rooms"}
            </Text>
            {g.departments?.length ? (
              <Text variant="caption" muted>
                {g.departments.join(", ")}
              </Text>
            ) : null}
          </View>
        </Card>
      ))}
    </View>
  );
}
