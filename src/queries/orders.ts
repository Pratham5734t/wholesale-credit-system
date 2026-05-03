import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  OrderItemRow,
  OrderRow,
  OrderStatus,
  ProfileRow,
} from "@/lib/database.types";

export interface OrderWithDetails extends OrderRow {
  items: OrderItemRow[];
  customer: Pick<ProfileRow, "id" | "name" | "phone"> | null;
}

export function useOrdersForOwner(filterStatus?: OrderStatus | "all") {
  return useQuery({
    queryKey: ["orders", "owner", filterStatus ?? "all"],
    queryFn: async (): Promise<OrderWithDetails[]> => {
      let q = supabase
        .from("orders")
        .select(
          "*, items:order_items(*), customer:profiles!orders_customer_id_fkey(id,name,phone)",
        )
        .order("created_at", { ascending: false });
      if (filterStatus && filterStatus !== "all") {
        q = q.eq("status", filterStatus);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as OrderWithDetails[];
    },
  });
}

export function useMyOrders(customerId: string | undefined) {
  return useQuery({
    queryKey: ["orders", "customer", customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<OrderWithDetails[]> => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, items:order_items(*), customer:profiles!orders_customer_id_fkey(id,name,phone)",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderWithDetails[];
    },
  });
}

export function useOrdersForCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ["orders", "by-customer", customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<OrderWithDetails[]> => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, items:order_items(*), customer:profiles!orders_customer_id_fkey(id,name,phone)",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderWithDetails[];
    },
  });
}

export interface PlaceOrderInput {
  customer_id: string;
  notes: string | null;
  items: {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
}

/**
 * Place an order via the `place_order` Postgres function. The RPC:
 *   - validates that the caller is a customer
 *   - re-looks-up every product's price + active status (server-trusted)
 *   - enforces the credit limit atomically against the live balance
 *   - inserts the order row + order_items in the same transaction
 *
 * On credit-limit overage the RPC raises an exception of the form
 * `CREDIT_LIMIT_EXCEEDED:<overage>`; we surface that as a typed error so the
 * UI can show the friendly toast.
 */
export class CreditLimitExceededError extends Error {
  overage: number;
  constructor(overage: number) {
    super(`CREDIT_LIMIT_EXCEEDED:${overage}`);
    this.name = "CreditLimitExceededError";
    this.overage = overage;
  }
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlaceOrderInput): Promise<{ id: string }> => {
      if (input.items.length === 0) throw new Error("Cart is empty.");

      const items = input.items.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      }));

      const { data, error } = await supabase.rpc("place_order", {
        p_notes: input.notes,
        p_items: items,
      });

      if (error) {
        const msg = error.message ?? "";
        const overageMatch = msg.match(/CREDIT_LIMIT_EXCEEDED:([\d.]+)/);
        if (overageMatch) {
          throw new CreditLimitExceededError(Number(overageMatch[1]));
        }
        if (msg.includes("PRODUCT_UNAVAILABLE")) {
          throw new Error("One of the products in your cart is no longer available.");
        }
        if (msg.includes("EMPTY_CART")) {
          throw new Error("Cart is empty.");
        }
        if (msg.includes("INVALID_QUANTITY")) {
          throw new Error("Invalid quantity in cart.");
        }
        if (msg.includes("NOT_A_CUSTOMER")) {
          throw new Error("Only customer accounts can place orders.");
        }
        throw new Error(msg || "Failed to place order.");
      }
      if (!data) throw new Error("Failed to place order.");

      return { id: data as string };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["balance"] });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: OrderStatus;
    }): Promise<OrderRow> => {
      const patch: Record<string, unknown> = { status: input.status };
      if (input.status === "confirmed") patch.confirmed_at = new Date().toISOString();
      if (input.status === "delivered") patch.delivered_at = new Date().toISOString();
      const { data, error } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["balance"] });
    },
  });
}
