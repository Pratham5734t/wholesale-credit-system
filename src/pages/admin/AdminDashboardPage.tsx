import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { useCustomers } from "@/queries/customers";
import { useOrdersForOwner } from "@/queries/orders";
import { useAllCustomerBalances } from "@/queries/balance";
import { formatINR, formatDate } from "@/lib/format";
import type { OrderStatus } from "@/lib/database.types";

const statusTone: Record<OrderStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending: "warning",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
};

export function AdminDashboardPage() {
  const customers = useCustomers();
  const orders = useOrdersForOwner("all");
  const customerIds = (customers.data ?? []).map((c) => c.id);
  const balances = useAllCustomerBalances(customerIds);

  const isLoading =
    customers.isLoading || orders.isLoading || balances.isLoading;
  if (isLoading) return <PageSpinner />;

  const allOrders = orders.data ?? [];
  const pendingOrders = allOrders.filter((o) => o.status === "pending");
  const todayOrders = allOrders.filter(
    (o) =>
      new Date(o.created_at).toDateString() === new Date().toDateString(),
  );

  const totalOutstanding = Object.values(balances.data ?? {}).reduce(
    (sum, b) => sum + b.outstanding,
    0,
  );
  const atLimitCustomers = (customers.data ?? []).filter((c) => {
    const b = balances.data?.[c.id];
    if (!b) return false;
    return b.outstanding >= c.credit_limit && c.credit_limit > 0;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending orders" value={String(pendingOrders.length)} tone={pendingOrders.length > 0 ? "warning" : undefined} />
        <StatCard label="Today's orders" value={String(todayOrders.length)} />
        <StatCard label="Total outstanding" value={formatINR(totalOutstanding)} tone={totalOutstanding > 0 ? "danger" : undefined} />
        <StatCard label="At credit limit" value={String(atLimitCustomers.length)} tone={atLimitCustomers.length > 0 ? "danger" : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Pending orders"
            action={
              <Link
                to="/admin/orders"
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                View all
              </Link>
            }
          />
          <CardBody className="!p-0">
            {pendingOrders.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">
                No pending orders.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {pendingOrders.slice(0, 8).map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {o.customer?.name ?? "Unknown"}{" "}
                        <Badge tone={statusTone[o.status]}>{o.status}</Badge>
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(o.created_at)} · {o.items.length} items
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {formatINR(o.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Customers at credit limit"
            action={
              <Link
                to="/admin/customers"
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                View all
              </Link>
            }
          />
          <CardBody className="!p-0">
            {atLimitCustomers.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">
                No one is at their limit.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {atLimitCustomers.slice(0, 8).map((c) => {
                  const b = balances.data?.[c.id];
                  return (
                    <li key={c.id} className="flex items-center justify-between px-5 py-3">
                      <Link
                        to={`/admin/customers/${c.id}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                      <span className="text-sm tabular-nums text-red-600">
                        {formatINR(b?.outstanding ?? 0)} / {formatINR(c.credit_limit)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "danger";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={
          "mt-1 text-2xl font-bold tabular-nums " +
          (tone === "danger"
            ? "text-red-600"
            : tone === "warning"
              ? "text-amber-600"
              : "text-slate-900")
        }
      >
        {value}
      </div>
    </div>
  );
}
