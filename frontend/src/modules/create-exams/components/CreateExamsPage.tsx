import { useState } from "react";
import CreateExamHeader from "./CreateExamHeader";
import ExamTypeSelector, { type ExamFlow } from "./ExamTypeSelector";
import CIEPage from "../pages/CIEPage";
import SEEExamSetupPage from "../see/pages/SEEExamSetupPage";
import { useCollegeFeatures } from "@/shared/hooks/useCollegeFeatures";

export default function CreateExamsPage() {
  const features = useCollegeFeatures();
  // Only the exam types the college has switched on; with just one there is
  // nothing to choose, so it opens directly.
  const available: ExamFlow[] = [...(features.cie ? ["CIE" as const] : []), ...(features.see ? ["SEE" as const] : [])];
  const [picked, setPicked] = useState<ExamFlow | null>(null);
  const selected = available.length === 1 ? available[0] : picked && available.includes(picked) ? picked : null;

  return (
    <div className="space-y-6">
      <CreateExamHeader />
      {available.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
          Exam creation is turned off for your college. Contact Proctavo support to turn on CIE or SEE exams.
        </p>
      ) : (
        <>
          {available.length > 1 && <ExamTypeSelector selected={selected} onSelect={setPicked} available={available} />}
          {selected === null && (
            <p className="pt-4 text-center text-sm text-gray-400">
              Select an exam type above to begin
            </p>
          )}
          {selected === "CIE" && <CIEPage />}
          {selected === "SEE" && <SEEExamSetupPage />}
        </>
      )}
    </div>
  );
}
