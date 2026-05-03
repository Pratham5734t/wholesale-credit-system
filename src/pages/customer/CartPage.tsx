import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomerBalance } from "@/queries/balance";
import { usePlaceOrder, CreditLimitExceededError } from "@/queries/orders";
import { formatINR } from "@/lib/format";

export function CartPage() {
  const cart = useCart();
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const balance = useCustomerBalance(profile?.id);
  const placeOrder = usePlaceOrder();
  const [notes, setNotes] = useState("");

  const creditLimit = profile?.credit_limit ?? 0;
  const outstanding = balance.data?.outstanding ?? 0;
  const available = Math.max(0, creditLimit - outstanding);
  const wouldOwe = outstanding + cart.total;
  // While the balance query is loading we don't know the real outstanding,
  // so we conservatively block the order to avoid bypassing the credit limit.
  const balanceUnknown = balance.isLoading || balance.isError;
  const overLimit = wouldOwe > creditLimit;
  const blockOrder = overLimit || balanceUnknown;

  if (cart.items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Add some products from the shop to get started."
        action={
          <Link to="/shop">
            <Button>Browse products</Button>
          </Link>
        }
      />
    );
  }

  const onPlaceOrder = async () => {
    if (!profile) return;
    if (balanceUnknown) {
      toast.error("Still checking your current balance — try again in a moment.");
      return;
    }
    if (overLimit) {
      toast.error(
        `This order would put you over your credit limit. Clear ${formatINR(
          wouldOwe - creditLimit,
        )} to continue.`,
      );
      return;
    }
    try {
      await placeOrder.mutateAsync({
        customer_id: profile.id,
        notes: notes.trim() || null,
        items: cart.items.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
      });
      cart.clear();
      toast.success("Order placed! Owner will confirm shortly.");
      navigate("/my-orders");
    } catch (err) {
      if (err instanceof CreditLimitExceededError) {
        toast.error(
          `This order would put you over your credit limit. Clear ${formatINR(
            err.overage,
          )} to continue.`,
        );
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to place order.");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader title="Your cart" />
          <CardBody className="!p-0">
            <ul className="divide-y divide-slate-200">
              {cart.items.map((i) => (
                <li
                  key={i.product_id}
                  className="flex items-center gap-3 px-5 py-4"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {i.image_url ? (
                      <img
                        src={i.image_url}
                        alt={i.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-slate-300">
                        📦
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{i.name}</div>
                    <div className="text-sm text-slate-500">
                      {formatINR(i.price)} each
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        cart.setQuantity(i.product_id, i.quantity - 1)
                      }
                      className="h-8 w-8 rounded border border-slate-300 text-lg text-slate-700 hover:bg-slate-50"
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-medium tabular-nums">
                      {i.quantity}
                    </span>
                    <button
                      onClick={() =>
                        cart.setQuantity(i.product_id, i.quantity + 1)
                      }
                      className="h-8 w-8 rounded border border-slate-300 text-lg text-slate-700 hover:bg-slate-50"
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                  <div className="w-20 text-right font-semibold tabular-nums text-slate-900">
                    {formatINR(i.price * i.quantity)}
                  </div>
                  <button
                    onClick={() => cart.remove(i.product_id)}
                    className="ml-1 text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="mt-4">
          <CardHeader title="Notes (optional)" />
          <CardBody>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the owner should know — delivery instructions, etc."
            />
          </CardBody>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader title="Summary" />
          <CardBody className="space-y-3 text-sm">
            <Row label="Items" value={String(cart.count)} />
            <Row label="Order total" value={formatINR(cart.total)} />
            <hr className="border-slate-200" />
            <Row
              label="Current balance owed"
              value={formatINR(outstanding)}
              loading={balance.isLoading}
            />
            <Row label="Credit limit" value={formatINR(creditLimit)} />
            <Row
              label="Available credit"
              value={formatINR(available)}
              tone={available <= 0 ? "danger" : "default"}
            />
            <hr className="border-slate-200" />
            <Row
              label="After this order"
              value={formatINR(wouldOwe)}
              tone={overLimit ? "danger" : "default"}
              bold
            />

            {overLimit ? (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                This order exceeds your credit limit by{" "}
                <strong>{formatINR(wouldOwe - creditLimit)}</strong>. Pay your
                pending balance to continue ordering.
              </div>
            ) : null}

            <Button
              onClick={onPlaceOrder}
              loading={placeOrder.isPending}
              disabled={blockOrder}
              className="w-full"
              size="lg"
            >
              {balance.isLoading ? "Checking balance…" : "Place order"}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone = "default",
  bold,
  loading,
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
  bold?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span
        className={
          (bold ? "font-semibold " : "") +
          (tone === "danger" ? "text-red-600" : "text-slate-900")
        }
      >
        {loading ? "…" : value}
      </span>
    </div>
  );
}
