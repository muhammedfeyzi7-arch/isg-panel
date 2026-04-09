import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import LoginPage from "../pages/login/page";
import ForgotPasswordPage from "../pages/forgot-password/page";
import ResetPasswordPage from "../pages/reset-password/page";
import ProtectedRoute from "../components/feature/ProtectedRoute";
import QrRedirectPage from "../pages/equipment/QrRedirectPage";
import SuperAdminLoginPage from "../pages/super-admin/login/page";
import SuperAdminPage from "../pages/super-admin/page";
import SubscriptionExpiredPage from "../pages/subscription-expired/page";

// Tüm modül route'ları — her biri Home component'ini render eder
// Home, URL'deki :module parametresini okuyarak doğru sayfayı gösterir
const MODULE_SLUGS = [
  'dashboard',
  'firmalar',
  'personeller',
  'evraklar',
  'firma-evraklari',
  'egitimler',
  'muayeneler',
  'tutanaklar',
  'uygunsuzluklar',
  'ekipmanlar',
  'is-izinleri',
  'saha',
  'raporlar',
  'copkutusu',
  'ayarlar',
];

const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/onboarding",
    element: <Navigate to="/" replace />,
  },
  // Root → dashboard'a yönlendir
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },
  // Her modül için ayrı route — element JSX olmalı (değişken geçilemez)
  ...MODULE_SLUGS.map(slug => ({
    path: `/${slug}`,
    element: (
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    ),
  })),
  {
    path: "/equipment/qr/:id",
    element: (
      <ProtectedRoute>
        <QrRedirectPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/super-admin/login",
    element: <SuperAdminLoginPage />,
  },
  {
    path: "/super-admin",
    element: <SuperAdminPage />,
  },
  {
    path: "/subscription-expired",
    element: <SubscriptionExpiredPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;