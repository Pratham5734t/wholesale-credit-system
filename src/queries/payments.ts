import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PaymentRow } from "@/lib/database.types";

export function usePaymentsForCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ["payments", customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<PaymentRow[]> => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface RecordPaymentInput {
  customer_id: string;
  amount: number;
  note: string | null;
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordPaymentInput): Promise<PaymentRow> => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("payments")
        .insert({
          customer_id: input.customer_id,
          amount: input.amount,
          note: input.note,
          recorded_by: userData.user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["payments", vars.customer_id] });
      void qc.invalidateQueries({ queryKey: ["balance"] });
    },
  });
}
