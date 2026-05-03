// Hand-written Supabase types matching supabase/migrations.
// Regenerate with `supabase gen types` later if you want.

export type ProfileRole = "owner" | "customer";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "delivered"
  | "cancelled";

export interface ProfileRow {
  id: string;
  role: ProfileRole;
  name: string;
  phone: string;
  credit_limit: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number | null;
  is_active: boolean;
  created_at: string;
}

export interface OrderRow {
  id: string;
  customer_id: string;
  status: OrderStatus;
  total: number;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  name_snapshot: string;
  price_snapshot: number;
  quantity: number;
  line_total: number;
}

export interface PaymentRow {
  id: string;
  customer_id: string;
  amount: number;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "created_at"> & { created_at?: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Omit<ProductRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: Omit<
          OrderRow,
          "id" | "created_at" | "confirmed_at" | "delivered_at"
        > & {
          id?: string;
          created_at?: string;
          confirmed_at?: string | null;
          delivered_at?: string | null;
        };
        Update: Partial<OrderRow>;
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: OrderItemRow;
        Insert: Omit<OrderItemRow, "id"> & { id?: string };
        Update: Partial<OrderItemRow>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: PaymentRow;
        Insert: Omit<PaymentRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<PaymentRow>;
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      profile_role: ProfileRole;
      order_status: OrderStatus;
    };
  };
}
