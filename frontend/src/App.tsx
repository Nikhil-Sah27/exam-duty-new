import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedLayout from "@/shared/components/ProtectedLayout";
import PageFallback from "@/shared/components/PageFallback";
import LoginForm from "@/modules/auth/components/LoginForm";
import RoleSelectionPage from "@/modules/auth/components/RoleSelectionPage";
import { invigilatorRoutes } from "@/modules/invigilator/routes/invigilatorRoutes";
import { rsRoutes } from "@/modules/rs/routes/rsRoutes";
import { dcsRoutes } from "@/modules/dcs/routes/dcsRoutes";

// Pages are lazy so each role/section only downloads its own chunk. The auth
// surfaces and layouts stay eager — they are the shell every visit needs.
const DashboardPage = lazy(() => import("@/modules/dashboard/components/DashboardPage"));
const CreateExamsPage = lazy(() => import("@/modules/create-exams/components/CreateExamsPage"));
const ExamsPage = lazy(() => import("@/modules/exams/components/ExamsPage"));
const CsMessagesPage = lazy(() => import("@/modules/messages/pages/CsMessagesPage"));
const ExamDetails = lazy(() => import("@/modules/exams/components/ExamDetails"));
const DutiesPage = lazy(() => import("@/modules/duties/components/DutiesPage"));
const UsersPage = lazy(() => import("@/modules/users/components/UsersPage"));
const ChangeRequestsPage = lazy(() => import("@/modules/change-requests/components/ChangeRequestsPage"));
const NotifyPage = lazy(() => import("@/modules/notify/components/NotifyPage"));
const DepartmentsPage = lazy(() => import("@/modules/departments/components/DepartmentsPage"));
const DepartmentDetailsPage = lazy(() => import("@/modules/departments/components/DepartmentDetailsPage"));
const InfrastructurePage = lazy(() => import("@/modules/infrastructure/components/InfrastructurePage"));
const BuildingDetailsPage = lazy(() => import("@/modules/infrastructure/components/BuildingDetailsPage"));
const ReportsPage = lazy(() => import("@/modules/reports/components/ReportsPage"));
const AuditPage = lazy(() => import("@/modules/audit/components/AuditPage"));
const ManageDutiesPage = lazy(() => import("@/modules/manage-duties/components/ManageDutiesPage"));
const TeacherDetailsPage = lazy(() => import("@/modules/manage-duties/components/TeacherDetailsPage"));
const AssignDutyExamsPage = lazy(() => import("@/modules/manage-duties/components/AssignDutyExamsPage"));
const AssignDutyExamDetailsPage = lazy(() => import("@/modules/manage-duties/components/AssignDutyExamDetailsPage"));
const AssignRSDutyPage = lazy(() => import("@/modules/manage-duties/components/AssignRSDutyPage"));
const AssignDCSDutyPage = lazy(() => import("@/modules/manage-duties/components/AssignDCSDutyPage"));

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/select-role" element={<RoleSelectionPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/create-exams" element={<CreateExamsPage />} />
          <Route path="/exams" element={<ExamsPage />} />
          <Route path="/exams/:id" element={<ExamDetails />} />
          <Route path="/messages" element={<CsMessagesPage />} />
          <Route path="/duties" element={<DutiesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/requests" element={<ChangeRequestsPage />} />
          <Route path="/manage-duties" element={<ManageDutiesPage />} />
          <Route path="/manage-duties/:id" element={<TeacherDetailsPage />} />
          <Route
            path="/manage-duties/:id/assign"
            element={<AssignDutyExamsPage />}
          />
          <Route
            path="/manage-duties/:id/assign/exams/:examId"
            element={<AssignDutyExamDetailsPage />}
          />
          <Route
            path="/manage-duties/:id/assign-rs"
            element={<AssignRSDutyPage />}
          />
          <Route
            path="/manage-duties/:id/assign-dcs"
            element={<AssignDCSDutyPage />}
          />
          <Route path="/notify" element={<NotifyPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/departments/:id" element={<DepartmentDetailsPage />} />
          <Route path="/infrastructure" element={<InfrastructurePage />} />
          <Route path="/infrastructure/:id" element={<BuildingDetailsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit" element={<AuditPage />} />
        </Route>
        {invigilatorRoutes}
        {rsRoutes}
        {dcsRoutes}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
