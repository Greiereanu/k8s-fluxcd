import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AlertsProvider } from "./context/AlertsContext";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { AlertToast } from "./components/AlertToast";
import { Navbar } from "./components/Navbar";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { ClientDashboard } from "./pages/client/ClientDashboard";
import { ProfileView } from "./pages/client/ProfileView";

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRole?: "ADMIN" | "CLIENT";
}> = ({ children, allowedRole }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-500">Loading session...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === "ADMIN" ? "/admin/dashboard" : "/client/dashboard"} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <ImpersonationBanner />
      <AlertToast />
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
};

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "ADMIN" ? "/admin/dashboard" : "/client/dashboard"} replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AlertsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRole="ADMIN">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Client Routes */}
            <Route
              path="/client/dashboard"
              element={
                <ProtectedRoute allowedRole="CLIENT">
                  <ClientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/profile"
              element={
                <ProtectedRoute allowedRole="CLIENT">
                  <ProfileView />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AlertsProvider>
    </AuthProvider>
  );
};

export default App;

