import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/theme";

import { CenterState, ScreenHeader } from "../components/ui";
import { examTitle } from "../format";
import { useExamGroups } from "../hooks/queries";
import { getTypeSubtitle } from "../shared/examStatusUtils";
import { DcsExamDuties } from "./DcsExamDuties";
import { InvigilatorExamDuties } from "./InvigilatorExamDuties";
import { RSExamDuties } from "./RSExamDuties";
import { asTeacherRole } from "./SelectDutyHome";

/**
 * /select/[examGroupId] — one exam's selectable duties for the ACTIVE role only
 * (a multi-role teacher sees one role's flow at a time, as on the web).
 */
export default function ExamDutiesScreen() {
  const { colors } = useTheme();
  const { examGroupId } = useLocalSearchParams<{ examGroupId: string }>();
  const role = asTeacherRole(useAuthStore((s) => s.user?.activeRole));
  const examsQ = useExamGroups();
  const exam = useMemo(() => examsQ.data?.find((g) => g._id === examGroupId), [examsQ.data, examGroupId]);

  const roleLabel = role === "rs" ? "RS groups" : role === "dcs" ? "DCS groups" : "Rooms";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title={exam ? examTitle(exam.examType, exam.semester) : "Select Duty"}
        subtitle={exam ? `${getTypeSubtitle(exam.examType)} · ${roleLabel}` : roleLabel}
      />
      {!examGroupId ? (
        <CenterState title="Exam not found" message="Go back and pick an exam." />
      ) : role === "invigilator" ? (
        <InvigilatorExamDuties examGroupId={examGroupId} />
      ) : role === "rs" ? (
        <RSExamDuties examGroupId={examGroupId} />
      ) : role === "dcs" ? (
        <DcsExamDuties examGroupId={examGroupId} />
      ) : (
        <CenterState
          title="Select Duty is for teachers"
          message="Switch to your Invigilator, RS or DCS role to pick duties."
        />
      )}
    </View>
  );
}
