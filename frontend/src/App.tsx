import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MonitorDetail from "./pages/MonitorDetail";
import Incidents from "./pages/Incidents";
import Profile from "./pages/Profile";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import License from "./pages/License";
import Settings from "./pages/Settings";
import PublicStatus from "./pages/PublicStatus";
import SystemStatus from "./pages/SystemStatus";
import Loader from "./components/Loader";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><Loader /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><Loader /></div>;
  // Logged-in users land on their dashboard; logged-out see the marketing page.
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/login" element={<Login />} />
      <Route path="/status" element={<SystemStatus />} />
      <Route path="/status/:ownerId" element={<PublicStatus />} />
      <Route path="/status/slug/:slug" element={<PublicStatus />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/monitor/:id" element={<RequireAuth><MonitorDetail /></RequireAuth>} />
      <Route path="/incidents" element={<RequireAuth><Incidents /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/license" element={<License />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
