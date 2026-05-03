import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomerBalance } from "@/queries/balance";
import { usePaymentsForCustomer } from "@/queries/payments";
import { formatINR, formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export function MyAccountPage() {
  const { profile } = useAuth();
  const balance = useCustomerBalance(profile?.id);
  const payments = usePaymentsForCustomer(profile?.id);

  if (!profile) return <PageSpinner />;

  const creditLimit = profile.credit_limit;
  const outstanding = balance.data?.outstanding ?? 0;
  const available = Math.max(0, creditLimit - outstanding);
  const usedPct = creditLimit > 0 ? Math.min(100, (outstanding / creditLimit) * 100) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Account</h1>

      <Card>
        <CardHeader title="Profile" />
        <CardBody className="space-y-2 text-sm">
          <Row label="Name" value={profile.name} />
          <Row label="Phone" value={formatPhone(profile.phone)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Credit" />
        <CardBody className="space-y-3 text-sm">
          <Row
            label="Outstanding balance"
            value={formatINR(outstanding)}
            loading={balance.isLoading}
            tone={outstanding > 0 ? "danger" : "default"}
            bold
          />
          <Row label="Credit limit" value={formatINR(creditLimit)} />
          <Row
            label="Available credit"
            value={formatINR(available)}
            tone={available <= 0 ? "danger" : "success"}
            bold
          />
          <div className="mt-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={
                  "h-full rounded-full " +
                  (usedPct >= 100
                    ? "bg-red-500"
                    : usedPct >= 75
                      ? "bg-amber-500"
                      : "bg-brand-500")
                }
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {usedPct.toFixed(0)}% of credit used
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Payment history" />
        <CardBody className="!p-0">
          {payments.isLoading ? (
            <div className="px-5 py-4 text-sm text-slate-500">Loading…</div>
          ) : !payments.data || payments.data.length === 0 ? (
            <div className="px-5 py-4 text-sm text-slate-500">
              No payments recorded yet.
            </div>
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
  tone?: "default" | "danger" | "success";
  bold?: boolean;
  loading?: boolean;
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
        {loading ? "…" : value}
      </span>
    </div>
  );
}
