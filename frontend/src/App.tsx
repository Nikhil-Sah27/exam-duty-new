import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedLayout from "@/shared/components/ProtectedLayout";
import LoginForm from "@/modules/auth/components/LoginForm";
import RoleSelectionPage from "@/modules/auth/components/RoleSelectionPage";
import DashboardPage from "@/modules/dashboard/components/DashboardPage";
import CreateExamsPage from "@/modules/create-exams/components/CreateExamsPage";
import ExamsPage from "@/modules/exams/components/ExamsPage";
import ExamDetails from "@/modules/exams/components/ExamDetails";
import DutiesPage from "@/modules/duties/components/DutiesPage";
import UsersPage from "@/modules/users/components/UsersPage";
import ChangeRequestsPage from "@/modules/change-requests/components/ChangeRequestsPage";
import NotifyPage from "@/modules/notify/components/NotifyPage";
import DepartmentsPage from "@/modules/departments/components/DepartmentsPage";
import DepartmentDetailsPage from "@/modules/departments/components/DepartmentDetailsPage";
import InfrastructurePage from "@/modules/infrastructure/components/InfrastructurePage";
import BuildingDetailsPage from "@/modules/infrastructure/components/BuildingDetailsPage";
import ReportsPage from "@/modules/reports/components/ReportsPage";
import AuditPage from "@/modules/audit/components/AuditPage";
import ManageDutiesPage from "@/modules/manage-duties/components/ManageDutiesPage";
import TeacherDetailsPage from "@/modules/manage-duties/components/TeacherDetailsPage";
import AssignDutyExamsPage from "@/modules/manage-duties/components/AssignDutyExamsPage";
import AssignDutyExamDetailsPage from "@/modules/manage-duties/components/AssignDutyExamDetailsPage";
import AssignRSDutyPage from "@/modules/manage-duties/components/AssignRSDutyPage";
import AssignDCSDutyPage from "@/modules/manage-duties/components/AssignDCSDutyPage";
import { invigilatorRoutes } from "@/modules/invigilator/routes/invigilatorRoutes";
import { rsRoutes } from "@/modules/rs/routes/rsRoutes";
import { dcsRoutes } from "@/modules/dcs/routes/dcsRoutes";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="/select-role" element={<RoleSelectionPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/create-exams" element={<CreateExamsPage />} />
        <Route path="/exams" element={<ExamsPage />} />
        <Route path="/exams/:id" element={<ExamDetails />} />
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
  );
}
