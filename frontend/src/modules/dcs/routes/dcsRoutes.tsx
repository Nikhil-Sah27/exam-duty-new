import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import DCSLayout from "../components/DCSLayout";

// Pages are lazy so the DCS chunk only loads for DCS users; the layout stays
// eager because it renders immediately on entry.
const Dashboard = lazy(() => import("../pages/Dashboard"));
const InvigilatorExamsPage = lazy(() => import("@/modules/invigilator/exams/pages/InvigilatorExamsPage"));
const InvigilatorExamDetailsPage = lazy(() => import("@/modules/invigilator/exams/pages/InvigilatorExamDetailsPage"));
const DCSSelectDutyPage = lazy(() => import("../select-duty/pages/SelectDutyPage"));
const DcsUpcomingDutiesPage = lazy(() => import("../upcoming-duties/pages/DcsUpcomingDutiesPage"));
const DcsChangeRequestsPage = lazy(() => import("../change-requests/pages/DcsChangeRequestsPage"));
const TeacherMessagesPage = lazy(() => import("@/modules/messages/pages/TeacherMessagesPage"));

/**
 * DCS reuses the Invigilator pages for Exams, gets its own Select Duty
 * (group-based, sized by student count), its own Upcoming Duties view
 * (per-room invigilator contacts), and its own Change Requests page that
 * operates on whole DCS duty groups instead of per-room duties.
 */
export const dcsRoutes = (
  <Route path="/dcs" element={<DCSLayout />}>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="exams" element={<InvigilatorExamsPage />} />
    <Route path="exams/:id" element={<InvigilatorExamDetailsPage />} />
    <Route path="select-duty" element={<DCSSelectDutyPage />} />
    <Route path="upcoming-duties" element={<DcsUpcomingDutiesPage />} />
    <Route path="messages" element={<TeacherMessagesPage />} />
    <Route path="change-requests" element={<DcsChangeRequestsPage />} />
  </Route>
);
