import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSpinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useOrdersForOwner, useUpdateOrderStatus } from "@/queries/orders";
import type { OrderStatus } from "@/lib/database.types";
import { formatINR, formatDate } from "@/lib/format";

const statusTone: Record<OrderStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending: "warning",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
};

const tabs: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

export function AdminOrdersPage() {
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const { data: orders, isLoading } = useOrdersForOwner(filter);
  const update = useUpdateOrderStatus();
  const toast = useToast();

  const onUpdateStatus = async (id: string, status: OrderStatus) => {
    try {
      await update.mutateAsync({ id, status });
      toast.success(`Order ${status}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update.");
    }
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Orders</h1>

      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition " +
              (filter === t.value
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {!orders || orders.length === 0 ? (
        <EmptyState title="No orders" description="Orders will appear here when customers place them." />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardHeader
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {o.customer?.name ?? "Unknown"}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onUpdateStatus(o.id, "confirmed")}
                        loading={update.isPending}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onUpdateStatus(o.id, "cancelled")}
                        loading={update.isPending}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : null}
                  {o.status === "confirmed" ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onUpdateStatus(o.id, "delivered")}
                      loading={update.isPending}
                    >
                      Mark delivered
                    </Button>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
