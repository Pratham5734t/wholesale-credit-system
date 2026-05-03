import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import { LoginPage } from "@/pages/LoginPage";
import { ShopPage } from "@/pages/customer/ShopPage";
import { CartPage } from "@/pages/customer/CartPage";
import { MyOrdersPage } from "@/pages/customer/MyOrdersPage";
import { MyAccountPage } from "@/pages/customer/MyAccountPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminProductsPage } from "@/pages/admin/AdminProductsPage";
import { AdminCustomersPage } from "@/pages/admin/AdminCustomersPage";
import { AdminCustomerDetailPage } from "@/pages/admin/AdminCustomerDetailPage";
import { AdminOrdersPage } from "@/pages/admin/AdminOrdersPage";
import { useAuth } from "@/contexts/AuthContext";

function CustomerLayout() {
  return (
    <ProtectedRoute requireRole="customer">
      <Layout />
    </ProtectedRoute>
  );
}

function AdminLayout() {
  return (
    <ProtectedRoute requireRole="owner">
      <Layout />
    </ProtectedRoute>
  );
}

function RoleHome() {
  const { profile } = useAuth();
  // ProtectedRoute already ensured profile exists.
  return (
    <Navigate to={profile?.role === "owner" ? "/admin" : "/shop"} replace />
  );
}

function HomeRedirect() {
  return (
    <ProtectedRoute>
      <RoleHome />
    </ProtectedRoute>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="text-5xl">🤔</div>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">
          Page not found
        </h1>
        <a href="/" className="mt-4 inline-block text-brand-600 hover:underline">
          Go home
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <HomeRedirect /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <CustomerLayout />,
    children: [
      { path: "/shop", element: <ShopPage /> },
      { path: "/cart", element: <CartPage /> },
      { path: "/my-orders", element: <MyOrdersPage /> },
      { path: "/my-account", element: <MyAccountPage /> },
    ],
  },
  {
    element: <AdminLayout />,
    children: [
      { path: "/admin", element: <AdminDashboardPage /> },
      { path: "/admin/orders", element: <AdminOrdersPage /> },
      { path: "/admin/products", element: <AdminProductsPage /> },
      { path: "/admin/customers", element: <AdminCustomersPage /> },
      { path: "/admin/customers/:id", element: <AdminCustomerDetailPage /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
