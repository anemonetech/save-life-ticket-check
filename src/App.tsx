import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { FullScreenLoader } from "./components/Spinner";
import LoginPage from "./pages/Login";
import PendingPage from "./pages/Pending";
import GenerationPage from "./pages/Generation";
import VerificationPage from "./pages/Verification";
import AdminPage from "./pages/Admin";
import DashboardPage from "./pages/Dashboard";
import NotFoundPage from "./pages/NotFound";

function HomeRedirect() {
  const { loading, user, role } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (role === "pending" || role === null)
    return <Navigate to="/en-attente" replace />;
  if (role === "verifier") return <Navigate to="/verification" replace />;
  if (role === "admin") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/generation" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/en-attente" element={<PendingPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allow={[]}>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/generation"
        element={
          <ProtectedRoute allow={["generator"]}>
            <Layout>
              <GenerationPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/verification"
        element={
          <ProtectedRoute allow={["verifier"]}>
            <Layout>
              <VerificationPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allow={[]}>
            <Layout>
              <AdminPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
