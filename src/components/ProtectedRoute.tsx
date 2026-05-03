import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageSpinner } from "@/components/ui/Spinner";

interface Props {
  children: ReactNode;
  requireRole?: "owner" | "customer";
}

export function ProtectedRoute({ children, requireRole }: Props) {
  const { loading, session, profile } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Wait for profile to load too — without it we can't enforce role.
  if (!profile) return <PageSpinner />;

  if (requireRole && profile.role !== requireRole) {
    const home = profile.role === "owner" ? "/admin" : "/shop";
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
