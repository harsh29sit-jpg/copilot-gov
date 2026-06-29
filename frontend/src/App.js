import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import MyRequests from "@/pages/MyRequests";
import NewRequest from "@/pages/NewRequest";
import Approvals from "@/pages/Approvals";
import Licenses from "@/pages/Licenses";
import Renewals from "@/pages/Renewals";
import Reclamation from "@/pages/Reclamation";
import Audit from "@/pages/Audit";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/my-requests" element={<ProtectedRoute roles={["employee"]}><MyRequests /></ProtectedRoute>} />
            <Route path="/my-requests/new" element={<ProtectedRoute roles={["employee"]}><NewRequest /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute roles={["manager", "admin"]}><Approvals /></ProtectedRoute>} />
            <Route path="/licenses" element={<ProtectedRoute roles={["manager", "admin"]}><Licenses /></ProtectedRoute>} />
            <Route path="/renewals" element={<Renewals />} />
            <Route path="/reclamation" element={<ProtectedRoute roles={["manager", "admin"]}><Reclamation /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute roles={["manager", "admin"]}><Audit /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
