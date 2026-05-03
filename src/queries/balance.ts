import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface CustomerBalance {
  customer_id: string;
  charged: number; // sum of confirmed/delivered orders
  paid: number; // sum of payments
  outstanding: number; // charged - paid
}

async function fetchBalance(customerId: string): Promise<CustomerBalance> {
  // Sum confirmed/delivered orders (ignore pending and cancelled).
  const { data: orderRows, error: orderErr } = await supabase
    .from("orders")
    .select("total,status")
    .eq("customer_id", customerId)
    .in("status", ["confirmed", "delivered"]);
  if (orderErr) throw orderErr;
  const charged = (orderRows ?? []).reduce(
    (sum, r) => sum + Number(r.total ?? 0),
    0,
  );

  const { data: payRows, error: payErr } = await supabase
    .from("payments")
    .select("amount")
    .eq("customer_id", customerId);
  if (payErr) throw payErr;
  const paid = (payRows ?? []).reduce(
    (sum, r) => sum + Number(r.amount ?? 0),
    0,
  );

  return {
    customer_id: customerId,
    charged,
    paid,
    outstanding: charged - paid,
  };
}

export function useCustomerBalance(customerId: string | undefined) {
  return useQuery({
    queryKey: ["balance", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) throw new Error("No customer id");
      return fetchBalance(customerId);
    },
  });
}

export function useAllCustomerBalances(customerIds: string[]) {
  return useQuery({
    queryKey: ["balance", "many", customerIds.slice().sort().join(",")],
    enabled: customerIds.length > 0,
    queryFn: async (): Promise<Record<string, CustomerBalance>> => {
      const result: Record<string, CustomerBalance> = {};
      // Fetch all relevant rows in two queries, then aggregate client-side.
      const [orderRes, payRes] = await Promise.all([
        supabase
          .from("orders")
          .select("customer_id,total,status")
          .in("customer_id", customerIds)
          .in("status", ["confirmed", "delivered"]),
        supabase
          .from("payments")
          .select("customer_id,amount")
          .in("customer_id", customerIds),
      ]);
      if (orderRes.error) throw orderRes.error;
      if (payRes.error) throw payRes.error;
      for (const id of customerIds) {
        result[id] = { customer_id: id, charged: 0, paid: 0, outstanding: 0 };
      }
      for (const row of orderRes.data ?? []) {
        const b = result[row.customer_id];
        if (b) b.charged += Number(row.total ?? 0);
      }
      for (const row of payRes.data ?? []) {
        const b = result[row.customer_id];
        if (b) b.paid += Number(row.amount ?? 0);
      }
      for (const id of Object.keys(result)) {
        result[id].outstanding = result[id].charged - result[id].paid;
      }
      return result;
    },
  });
}
