import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import InvigilatorLayout from "../components/InvigilatorLayout";

// Pages are lazy so the invigilator chunk only loads for invigilator users;
// the layout stays eager because it renders immediately on entry.
const Dashboard = lazy(() => import("../pages/Dashboard"));
const InvigilatorExamsPage = lazy(() => import("../exams/pages/InvigilatorExamsPage"));
const InvigilatorExamDetailsPage = lazy(() => import("../exams/pages/InvigilatorExamDetailsPage"));
const SelectDutyPage = lazy(() => import("../select-duty/pages/SelectDutyPage"));
const InvigilatorChangeRequestsPage = lazy(() => import("../change-requests/pages/InvigilatorChangeRequestsPage"));
const UpcomingDutiesPage = lazy(() => import("../upcoming-duties/pages/UpcomingDutiesPage"));

export const invigilatorRoutes = (
  <Route path="/invigilator" element={<InvigilatorLayout />}>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="exams" element={<InvigilatorExamsPage />} />
    <Route path="exams/:id" element={<InvigilatorExamDetailsPage />} />
    <Route path="select-duty" element={<SelectDutyPage />} />
    <Route path="upcoming-duties" element={<UpcomingDutiesPage />} />
    <Route path="change-requests" element={<InvigilatorChangeRequestsPage />} />
  </Route>
);
