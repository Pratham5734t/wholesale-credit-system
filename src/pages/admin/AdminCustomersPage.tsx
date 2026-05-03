import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label, FieldError } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSpinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
} from "@/queries/customers";
import { useAllCustomerBalances } from "@/queries/balance";
import type { ProfileRow } from "@/lib/database.types";
import { formatINR } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

interface FormData {
  name: string;
  phone: string;
  password: string;
  credit_limit: string;
}

export function AdminCustomersPage() {
  const { data: customers, isLoading } = useCustomers();
  const ids = (customers ?? []).map((c) => c.id);
  const balances = useAllCustomerBalances(ids);
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const toast = useToast();

  const [showNew, setShowNew] = useState(false);
  const [editLimit, setEditLimit] = useState<ProfileRow | null>(null);

  const form = useForm<FormData>({
    defaultValues: { name: "", phone: "", password: "", credit_limit: "10000" },
  });

  const limitForm = useForm<{ credit_limit: string }>({
    defaultValues: { credit_limit: "" },
  });

  const openNew = useCallback(() => {
    form.reset({ name: "", phone: "", password: "", credit_limit: "10000" });
    setShowNew(true);
  }, [form]);

  const openEditLimit = useCallback(
    (c: ProfileRow) => {
      limitForm.reset({ credit_limit: String(c.credit_limit) });
      setEditLimit(c);
    },
    [limitForm],
  );

  const onCreateCustomer = form.handleSubmit(async (data) => {
    try {
      await create.mutateAsync({
        name: data.name.trim(),
        phone: data.phone.trim(),
        password: data.password,
        credit_limit: Number(data.credit_limit),
      });
      toast.success("Customer created.");
      setShowNew(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create customer.");
    }
  });

  const onUpdateLimit = limitForm.handleSubmit(async (data) => {
    if (!editLimit) return;
    try {
      await update.mutateAsync({
        id: editLimit.id,
        credit_limit: Number(data.credit_limit),
      });
      toast.success("Credit limit updated.");
      setEditLimit(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update.");
    }
  });

  const onToggleActive = async (c: ProfileRow) => {
    try {
      await update.mutateAsync({ id: c.id, is_active: !c.is_active });
      toast.success(c.is_active ? "Customer deactivated." : "Customer activated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    }
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Customers</h1>
        <Button onClick={openNew}>+ Add customer</Button>
      </div>

      {!customers || customers.length === 0 ? (
        <EmptyState
          title="No customers"
          description="Add your first customer to get started."
          action={<Button onClick={openNew}>+ Add customer</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {customers.map((c) => {
            const b = balances.data?.[c.id];
            const outstanding = b?.outstanding ?? 0;
            const atLimit = c.credit_limit > 0 && outstanding >= c.credit_limit;
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/admin/customers/${c.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                      {!c.is_active ? (
                        <Badge tone="neutral">Inactive</Badge>
                      ) : null}
                      {atLimit ? (
                        <Badge tone="danger">At limit</Badge>
                      ) : null}
                    </div>
                    <div className="text-sm text-slate-500">
                      {formatPhone(c.phone)} · Limit:{" "}
                      {formatINR(c.credit_limit)} · Owing:{" "}
                      <span
                        className={
                          outstanding > 0 ? "text-red-600" : "text-slate-600"
                        }
                      >
                        {formatINR(outstanding)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditLimit(c)}
                    >
                      Edit limit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleActive(c)}
                    >
                      {c.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Link to={`/admin/customers/${c.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Customer Modal */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="Add customer"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={onCreateCustomer}>
              Add customer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label required>Name</Label>
            <Input {...form.register("name", { required: "Required" })} />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div>
            <Label required>Phone number</Label>
            <Input
              inputMode="numeric"
              placeholder="98765 43210"
              {...form.register("phone", { required: "Required" })}
            />
            <FieldError message={form.formState.errors.phone?.message} />
          </div>
          <div>
            <Label required>Password</Label>
            <Input
              type="text"
              placeholder="Set a password for this customer"
              {...form.register("password", {
                required: "Required",
                minLength: { value: 4, message: "At least 4 characters" },
              })}
            />
            <FieldError message={form.formState.errors.password?.message} />
          </div>
          <div>
            <Label required>Credit limit (₹)</Label>
            <Input
              type="number"
              min="0"
              {...form.register("credit_limit", { required: "Required" })}
            />
          </div>
        </div>
      </Modal>

      {/* Edit Credit Limit Modal */}
      <Modal
        open={!!editLimit}
        onClose={() => setEditLimit(null)}
        title={`Edit credit limit — ${editLimit?.name ?? ""}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditLimit(null)}>
              Cancel
            </Button>
            <Button loading={update.isPending} onClick={onUpdateLimit}>
              Save
            </Button>
          </>
        }
      >
        <div>
          <Label required>Credit limit (₹)</Label>
          <Input
            type="number"
            min="0"
            {...limitForm.register("credit_limit", { required: "Required" })}
          />
        </div>
      </Modal>
    </div>
  );
}
