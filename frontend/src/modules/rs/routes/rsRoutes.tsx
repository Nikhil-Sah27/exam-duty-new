import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import RSLayout from "../components/RSLayout";

// Pages are lazy so the RS chunk only loads for RS users; the layout stays
// eager because it renders immediately on entry.
const Dashboard = lazy(() => import("../pages/Dashboard"));
const InvigilatorExamsPage = lazy(() => import("@/modules/invigilator/exams/pages/InvigilatorExamsPage"));
const InvigilatorExamDetailsPage = lazy(() => import("@/modules/invigilator/exams/pages/InvigilatorExamDetailsPage"));
const RSSelectDutyPage = lazy(() => import("@/modules/rs/select-duty/pages/SelectDutyPage"));
const RSUpcomingDutiesPage = lazy(() => import("@/modules/rs/upcoming-duties/pages/RSUpcomingDutiesPage"));
const RsChangeRequestsPage = lazy(() => import("@/modules/rs/change-requests/pages/RsChangeRequestsPage"));
const TeacherMessagesPage = lazy(() => import("@/modules/messages/pages/TeacherMessagesPage"));

/**
 * RS reuses the Invigilator pages for exams + change-requests, but has its
 * own select-duty and upcoming-duties surfaces because RS is group-oriented
 * (5 rooms per chunk, per block/exam/time). Select Duty picks a group;
 * Upcoming Duties displays those selections as one group card, not one card
 * per individual room.
 */
export const rsRoutes = (
  <Route path="/rs" element={<RSLayout />}>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="exams" element={<InvigilatorExamsPage />} />
    <Route path="exams/:id" element={<InvigilatorExamDetailsPage />} />
    <Route path="select-duty" element={<RSSelectDutyPage />} />
    <Route path="upcoming-duties" element={<RSUpcomingDutiesPage />} />
    <Route path="messages" element={<TeacherMessagesPage />} />
    <Route path="change-requests" element={<RsChangeRequestsPage />} />
  </Route>
);
