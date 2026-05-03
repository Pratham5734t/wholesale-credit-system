import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/phone";

interface NavItem {
  to: string;
  label: string;
  badge?: string | number | null;
  end?: boolean;
}

export function Layout() {
  const { profile, signOut } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();

  const isOwner = profile?.role === "owner";

  const customerNav: NavItem[] = [
    { to: "/shop", label: "Shop" },
    {
      to: "/cart",
      label: "Cart",
      badge: cart.count > 0 ? cart.count : null,
    },
    { to: "/my-orders", label: "My Orders" },
    { to: "/my-account", label: "Account" },
  ];

  const ownerNav: NavItem[] = [
    { to: "/admin", label: "Dashboard", end: true },
    { to: "/admin/orders", label: "Orders" },
    { to: "/admin/products", label: "Products" },
    { to: "/admin/customers", label: "Customers" },
  ];

  const nav = isOwner ? ownerNav : customerNav;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
              W
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 leading-none">
                Wholesale
              </div>
              <div className="text-[11px] text-slate-500 leading-none mt-0.5">
                {isOwner ? "Owner" : "Customer"}
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  {item.badge != null ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-900 leading-none">
                {profile?.name ?? "—"}
              </div>
              <div className="text-[11px] text-slate-500 leading-none mt-0.5">
                {profile?.phone ? formatPhone(profile.phone) : ""}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile bottom-style nav as a horizontal scroll under the header */}
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto border-t border-slate-200 bg-white px-2 py-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )
              }
            >
              <span className="inline-flex items-center gap-1.5">
                {item.label}
                {item.badge != null ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Wholesale Credit System
      </footer>
    </div>
  );
}
