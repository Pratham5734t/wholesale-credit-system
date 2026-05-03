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

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlaceOrderInput): Promise<OrderRow> => {
      if (input.items.length === 0) throw new Error("Cart is empty.");
      const total = input.items.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0,
      );

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          customer_id: input.customer_id,
          status: "pending",
          total,
          notes: input.notes,
        })
        .select("*")
        .single();
      if (orderErr) throw orderErr;

      const items = input.items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        name_snapshot: i.name,
        price_snapshot: i.price,
        quantity: i.quantity,
        line_total: i.price * i.quantity,
      }));

      const { error: itemsErr } = await supabase
        .from("order_items")
        .insert(items);
      if (itemsErr) {
        // best effort cleanup
        await supabase.from("orders").delete().eq("id", order.id);
        throw itemsErr;
      }

      return order;
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
