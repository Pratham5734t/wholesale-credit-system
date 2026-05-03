import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label, FieldError } from "@/components/ui/Label";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PageSpinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useCustomer } from "@/queries/customers";
import { useCustomerBalance } from "@/queries/balance";
import { useOrdersForCustomer } from "@/queries/orders";
import { usePaymentsForCustomer, useRecordPayment } from "@/queries/payments";
import type { OrderStatus } from "@/lib/database.types";
import { formatINR, formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

const statusTone: Record<OrderStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending: "warning",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
};

export function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const customer = useCustomer(id);
  const balance = useCustomerBalance(id);
  const orders = useOrdersForCustomer(id);
  const payments = usePaymentsForCustomer(id);
  const recordPayment = useRecordPayment();
  const toast = useToast();

  const [showPayment, setShowPayment] = useState(false);
  const payForm = useForm<{ amount: string; note: string }>({
    defaultValues: { amount: "", note: "" },
  });

  const onPay = payForm.handleSubmit(async (data) => {
    if (!id) return;
    try {
      await recordPayment.mutateAsync({
        customer_id: id,
        amount: Number(data.amount),
        note: data.note.trim() || null,
      });
      toast.success("Payment recorded.");
      payForm.reset();
      setShowPayment(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    }
  });

  if (customer.isLoading) return <PageSpinner />;
  const c = customer.data;
  if (!c) {
    return (
      <div className="text-center text-sm text-slate-500 py-12">
        Customer not found.{" "}
        <Link to="/admin/customers" className="text-brand-600 hover:underline">
          Back to customers
        </Link>
      </div>
    );
  }

  const outstanding = balance.data?.outstanding ?? 0;
  const available = Math.max(0, c.credit_limit - outstanding);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/admin/customers" className="hover:underline">
          Customers
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{c.name}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile + Balance */}
        <Card>
          <CardHeader title="Profile" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Name" value={c.name} />
            <Row label="Phone" value={formatPhone(c.phone)} />
            <Row
              label="Status"
              value={c.is_active ? "Active" : "Inactive"}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Credit"
            action={
              <Button size="sm" onClick={() => setShowPayment(true)}>
                Record payment
              </Button>
            }
          />
          <CardBody className="space-y-2 text-sm">
            <Row label="Credit limit" value={formatINR(c.credit_limit)} />
            <Row
              label="Outstanding"
              value={formatINR(outstanding)}
              tone={outstanding > 0 ? "danger" : "default"}
              bold
            />
            <Row
              label="Available"
              value={formatINR(available)}
              tone={available <= 0 ? "danger" : "success"}
              bold
            />
            <Row
              label="Total charged"
              value={formatINR(balance.data?.charged ?? 0)}
            />
            <Row
              label="Total paid"
              value={formatINR(balance.data?.paid ?? 0)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stats" />
          <CardBody className="space-y-2 text-sm">
            <Row
              label="Total orders"
              value={String(orders.data?.length ?? 0)}
            />
            <Row
              label="Total payments"
              value={String(payments.data?.length ?? 0)}
            />
          </CardBody>
        </Card>
      </div>

      {/* Order history */}
      <Card>
        <CardHeader title="Order history" />
        <CardBody className="!p-0">
          {orders.isLoading ? (
            <p className="px-5 py-4 text-sm text-slate-500">Loading…</p>
          ) : !orders.data || orders.data.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {orders.data.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-slate-500">
                        #{o.id.slice(0, 8)}
                      </span>
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

      {/* Payment history */}
      <Card>
        <CardHeader title="Payment history" />
        <CardBody className="!p-0">
          {payments.isLoading ? (
            <p className="px-5 py-4 text-sm text-slate-500">Loading…</p>
          ) : !payments.data || payments.data.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">
              No payments recorded.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {payments.data.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <div className="text-sm text-slate-900">
                      {formatDate(p.created_at)}
                    </div>
                    {p.note ? (
                      <div className="text-xs text-slate-500">{p.note}</div>
                    ) : null}
                  </div>
                  <div className="font-semibold text-green-700 tabular-nums">
                    + {formatINR(p.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Record payment modal */}
      <Modal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        title={`Record payment — ${c.name}`}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowPayment(false)}
            >
              Cancel
            </Button>
            <Button loading={recordPayment.isPending} onClick={onPay}>
              Record
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label required>Amount (₹)</Label>
            <Input
              type="number"
              min="1"
              step="0.01"
              {...payForm.register("amount", {
                required: "Required",
                min: { value: 1, message: "Amount must be at least ₹1" },
              })}
            />
            <FieldError
              message={payForm.formState.errors.amount?.message}
            />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input
              {...payForm.register("note")}
              placeholder="e.g. Cash payment"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({
  label,
  value,
  tone = "default",
  bold,
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success";
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span
        className={
          (bold ? "font-semibold " : "") +
          (tone === "danger"
            ? "text-red-600"
            : tone === "success"
              ? "text-green-700"
              : "text-slate-900")
        }
      >
        {value}
      </span>
    </div>
  );
}
