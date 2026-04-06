import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import LoginPage from "../pages/login/page";
import ForgotPasswordPage from "../pages/forgot-password/page";
import ResetPasswordPage from "../pages/reset-password/page";
import OnboardingPage from "../pages/onboarding/page";
import ProtectedRoute from "../components/feature/ProtectedRoute";
import QrDetailPage from "../pages/equipment/QrDetailPage";

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
    element: (
      <ProtectedRoute>
        <OnboardingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    ),
  },
  {
    // QR kod sayfası — ProtectedRoute ile korunuyor
    // Giriş yapılmamışsa /login'e yönlendirir
    // Giriş yapıldıktan sonra organization bazlı veri gösterir
    path: "/equipment/qr/:id",
    element: (
      <ProtectedRoute>
        <QrDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;