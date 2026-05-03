import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ProductRow } from "@/lib/database.types";

export function useProducts(opts?: { activeOnly?: boolean }) {
  return useQuery({
    queryKey: ["products", { activeOnly: opts?.activeOnly ?? false }],
    queryFn: async (): Promise<ProductRow[]> => {
      let q = supabase.from("products").select("*").order("created_at", {
        ascending: false,
      });
      if (opts?.activeOnly) {
        q = q.eq("is_active", true);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface ProductInput {
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number | null;
  is_active: boolean;
}

export function useUpsertProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: ProductInput & { id?: string },
    ): Promise<ProductRow> => {
      if (input.id) {
        const { data, error } = await supabase
          .from("products")
          .update({
            name: input.name,
            description: input.description,
            price: input.price,
            image_url: input.image_url,
            stock: input.stock,
            is_active: input.is_active,
          })
          .eq("id", input.id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("products")
        .insert({
          name: input.name,
          description: input.description,
          price: input.price,
          image_url: input.image_url,
          stock: input.stock,
          is_active: input.is_active,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

const BUCKET = "product-images";

export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
  const path = `${crypto.randomUUID()}.${safeExt}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
