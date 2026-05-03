import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ProfileRow } from "@/lib/database.types";
import { phoneToEmail, normalizePhone } from "@/lib/phone";

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "customer")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customer", id],
    enabled: !!id,
    queryFn: async (): Promise<ProfileRow | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  password: string;
  credit_limit: number;
}

/**
 * Create a customer.
 *
 * Steps:
 *  1) Create the auth user with email = phoneToEmail(phone) and the given password.
 *     We use the public signUp endpoint — Supabase will sign the new user in,
 *     so we immediately sign back in as the owner afterwards.
 *  2) Insert (or upsert) the profile row with role='customer', credit_limit, etc.
 *
 * NOTE: For a multi-owner deployment you'd want a server-side function with
 *       the service role key. For a single-owner shop this works fine.
 */
export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCustomerInput): Promise<ProfileRow> => {
      const phone = normalizePhone(input.phone);
      const email = phoneToEmail(phone);

      // Capture the owner's current session so we can restore it.
      const { data: ownerSession } = await supabase.auth.getSession();
      const ownerAccessToken = ownerSession.session?.access_token;
      const ownerRefreshToken = ownerSession.session?.refresh_token;

      const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
          data: { name: input.name, phone },
        },
      });
      if (signUpErr) {
        throw new Error(
          signUpErr.message.includes("registered")
            ? "A customer with this phone already exists."
            : signUpErr.message,
        );
      }
      const userId = signUp.user?.id;
      if (!userId) throw new Error("Failed to create user.");

      // Restore the owner's session.
      if (ownerAccessToken && ownerRefreshToken) {
        await supabase.auth.setSession({
          access_token: ownerAccessToken,
          refresh_token: ownerRefreshToken,
        });
      }

      // Upsert profile (a trigger may have inserted a row already).
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            role: "customer",
            name: input.name,
            phone,
            credit_limit: input.credit_limit,
            is_active: true,
          },
          { onConflict: "id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export interface UpdateCustomerInput {
  id: string;
  name?: string;
  credit_limit?: number;
  is_active?: boolean;
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCustomerInput): Promise<ProfileRow> => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.credit_limit !== undefined)
        patch.credit_limit = input.credit_limit;
      if (input.is_active !== undefined) patch.is_active = input.is_active;
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer", variables.id] });
    },
  });
}
