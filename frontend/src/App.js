import { Toaster } from "sonner";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import PatientDashboard from "@/pages/patient/PatientDashboard";
import NakesDashboard from "@/pages/nakes/NakesDashboard";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import { Loader2 } from "lucide-react";
import "@/App.css";

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={`/${user.role === "nakes" ? "nakes" : user.role}`} replace />;
  return children;
}

function DashboardRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const map = { patient: "/pasien", nakes: "/nakes", admin: "/admin" };
  return <Navigate to={map[user.role]} replace />;
}

function AppRoutes() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<DashboardRedirect />} />
      <Route path="/pasien" element={<Protected role="patient"><PatientDashboard /></Protected>} />
      <Route path="/nakes" element={<Protected role="nakes"><NakesDashboard /></Protected>} />
      <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
