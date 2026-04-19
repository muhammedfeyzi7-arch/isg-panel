import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import NotFound from '@/pages/NotFound';
import ProtectedRoute from '@/components/feature/ProtectedRoute';

// Admin pages
import AdminHome from '@/pages/home/page';
import FirmalarPage from '@/pages/firmalar/page';
import PersonelPage from '@/pages/personel/page';
import ZiyaretlerPage from '@/pages/ziyaretler/page';
import RaporlarPage from '@/pages/raporlar/page';
import AyarlarPage from '@/pages/ayarlar/page';
import ActivityLogsPage from '@/pages/admin/activity-logs/page';

// Specialist layout + pages
import SpecialistLayout from '@/pages/specialist/layout';
import SpecialistDashboard from '@/pages/specialist/dashboard/page';
import SpecialistFirmsPage from '@/pages/specialist/firms/page';
import CompanyDocumentsPage from '@/pages/specialist/company-documents/page';
import DocumentTrackingPage from '@/pages/specialist/document-tracking/page';
import TrainingsPage from '@/pages/specialist/trainings/page';
import SpecialistHealthStatusPage from '@/pages/specialist/health-status/page';
import FieldInspectionPage from '@/pages/specialist/field-inspection/page';
import EquipmentPage from '@/pages/specialist/equipment/page';
import WorkPermitsPage from '@/pages/specialist/work-permits/page';
import SpecialistReportsPage from '@/pages/specialist/reports/page';
import SpecialistDocumentsPage from '@/pages/specialist/documents/page';
import SpecialistTrashPage from '@/pages/specialist/trash/page';
import SpecialistSettingsPage from '@/pages/specialist/settings/page';
import SpecialistPersonnelPage from '@/pages/specialist/personnel/page';
import SpecialistMinutesPage from '@/pages/specialist/minutes/page';

// Doctor layout + pages
import DoctorLayout from '@/pages/doctor/layout';
import DoctorDashboard from '@/pages/doctor/dashboard/page';
import DoctorFirmsPage from '@/pages/doctor/firms/page';
import DoctorPersonnelPage from '@/pages/doctor/personnel/page';
import DoctorHealthStatusPage from '@/pages/doctor/health-status/page';
import IncidentReportsPage from '@/pages/doctor/incident-reports/page';
import DoctorFieldVisitPage from '@/pages/doctor/field-visit/page';

const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/admin" replace /> },

  // ─── Admin Panel ───────────────────────────────────────────────────────────
  { path: '/admin', element: <ProtectedRoute requiredRole="admin"><AdminHome /></ProtectedRoute> },
  { path: '/admin/firmalar', element: <ProtectedRoute requiredRole="admin"><FirmalarPage /></ProtectedRoute> },
  { path: '/admin/personel', element: <ProtectedRoute requiredRole="admin"><PersonelPage /></ProtectedRoute> },
  { path: '/admin/ziyaretler', element: <ProtectedRoute requiredRole="admin"><ZiyaretlerPage /></ProtectedRoute> },
  { path: '/admin/raporlar', element: <ProtectedRoute requiredRole="admin"><RaporlarPage /></ProtectedRoute> },
  { path: '/admin/ayarlar', element: <ProtectedRoute requiredRole="admin"><AyarlarPage /></ProtectedRoute> },
  { path: '/admin/activity-logs', element: <ProtectedRoute requiredRole="admin"><ActivityLogsPage /></ProtectedRoute> },

  // ─── Specialist Panel ──────────────────────────────────────────────────────
  {
    path: '/specialist',
    element: <ProtectedRoute requiredRole="specialist"><SpecialistLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <SpecialistDashboard /> },
      { path: 'firms', element: <SpecialistFirmsPage /> },
      { path: 'personnel', element: <SpecialistPersonnelPage /> },
      { path: 'minutes', element: <SpecialistMinutesPage /> },
      { path: 'company-documents', element: <CompanyDocumentsPage /> },
      { path: 'document-tracking', element: <DocumentTrackingPage /> },
      { path: 'trainings', element: <TrainingsPage /> },
      { path: 'health-status', element: <SpecialistHealthStatusPage /> },
      { path: 'field-inspection', element: <FieldInspectionPage /> },
      { path: 'equipment', element: <EquipmentPage /> },
      { path: 'work-permits', element: <WorkPermitsPage /> },
      { path: 'reports', element: <SpecialistReportsPage /> },
      { path: 'documents', element: <SpecialistDocumentsPage /> },
      { path: 'trash', element: <SpecialistTrashPage /> },
      { path: 'settings', element: <SpecialistSettingsPage /> },
    ],
  },

  // ─── Doctor Panel ──────────────────────────────────────────────────────────
  {
    path: '/doctor',
    element: <ProtectedRoute requiredRole="doctor"><DoctorLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <DoctorDashboard /> },
      { path: 'firms', element: <DoctorFirmsPage /> },
      { path: 'personnel', element: <DoctorPersonnelPage /> },
      { path: 'health-status', element: <DoctorHealthStatusPage /> },
      { path: 'incident-reports', element: <IncidentReportsPage /> },
      { path: 'field-visit', element: <DoctorFieldVisitPage /> },
    ],
  },

  // Legacy redirects
  { path: '/firmalar', element: <Navigate to="/admin/firmalar" replace /> },
  { path: '/personel', element: <Navigate to="/admin/personel" replace /> },
  { path: '/ziyaretler', element: <Navigate to="/admin/ziyaretler" replace /> },
  { path: '/raporlar', element: <Navigate to="/admin/raporlar" replace /> },
  { path: '/ayarlar', element: <Navigate to="/admin/ayarlar" replace /> },

  { path: '*', element: <NotFound /> },
];

export default routes;
