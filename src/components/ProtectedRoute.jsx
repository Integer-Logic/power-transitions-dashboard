import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoadingScreen from "./LoadingScreen";

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Still loading auth state
  if (loading) return <LoadingScreen />;

  // Not logged in: send to login and remember where user was going
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Admin check (safe even if role is missing)
  const role = user?.role || user?.user?.role || user?.data?.role;

  if (requireAdmin && role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
