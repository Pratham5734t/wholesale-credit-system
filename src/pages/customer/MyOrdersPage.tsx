import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSpinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/contexts/AuthContext";
import { useMyOrders } from "@/queries/orders";
import type { OrderStatus } from "@/lib/database.types";
import { formatDate } from "@/lib/format";
import { formatINR } from "@/lib/format";

const statusTone: Record<OrderStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending: "warning",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
};

export function MyOrdersPage() {
  const { profile } = useAuth();
  const { data: orders, isLoading, error } = useMyOrders(profile?.id);

  if (isLoading) return <PageSpinner />;
  if (error) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-red-600">
            Failed to load orders: {(error as Error).message}
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Once you place an order it will show up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-slate-900">My orders</h1>
      {orders.map((o) => (
        <Card key={o.id}>
          <CardHeader
            title={
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-slate-500">
                  #{o.id.slice(0, 8)}
                </span>
                <Badge tone={statusTone[o.status]}>{o.status}</Badge>
              </div>
            }
            description={formatDate(o.created_at)}
            action={
              <span className="text-base font-semibold text-slate-900">
                {formatINR(o.total)}
              </span>
            }
          />
          <CardBody className="!py-3">
            <ul className="divide-y divide-slate-100 text-sm">
              {o.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-slate-700">
                    {item.name_snapshot}{" "}
                    <span className="text-slate-500">× {item.quantity}</span>
                  </span>
                  <span className="font-medium tabular-nums text-slate-900">
                    {formatINR(item.line_total)}
                  </span>
                </li>
              ))}
            </ul>
            {o.notes ? (
              <p className="mt-2 text-xs italic text-slate-500">
                Note: {o.notes}
              </p>
            ) : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
