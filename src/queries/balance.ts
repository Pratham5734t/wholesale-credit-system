import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface CustomerBalance {
  customer_id: string;
  charged: number; // sum of confirmed/delivered orders
  paid: number; // sum of payments
  outstanding: number; // charged - paid
}

interface RpcBalanceRow {
  customer_id: string;
  charged: number | string;
  paid: number | string;
  outstanding: number | string;
}

function normalizeRow(row: RpcBalanceRow): CustomerBalance {
  return {
    customer_id: row.customer_id,
    charged: Number(row.charged ?? 0),
    paid: Number(row.paid ?? 0),
    outstanding: Number(row.outstanding ?? 0),
  };
}

async function fetchBalance(customerId: string): Promise<CustomerBalance> {
  const { data, error } = await supabase.rpc("customer_balance", {
    p_customer_id: customerId,
  });
  if (error) throw error;
  const rows = (data ?? []) as RpcBalanceRow[];
  if (rows.length === 0) {
    return { customer_id: customerId, charged: 0, paid: 0, outstanding: 0 };
  }
  return normalizeRow(rows[0]);
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
      const { data, error } = await supabase.rpc("all_customer_balances");
      if (error) throw error;
      const result: Record<string, CustomerBalance> = {};
      for (const id of customerIds) {
        result[id] = { customer_id: id, charged: 0, paid: 0, outstanding: 0 };
      }
      for (const row of (data ?? []) as RpcBalanceRow[]) {
        if (row.customer_id in result) {
          result[row.customer_id] = normalizeRow(row);
        }
      }
      return result;
    },
  });
}
