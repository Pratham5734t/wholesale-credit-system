import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
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
 * The signUp call is made on a *separate* Supabase client that does NOT persist
 * its session, so the owner's auth session on the main client is untouched.
 * (Calling signUp on the main client would auto-sign-in as the new customer,
 * fire onAuthStateChange, and bounce the owner out of /admin.)
 *
 * Then upsert the profile row with role='customer', credit_limit, etc — this
 * write goes through the owner's RLS context on the main client.
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

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const ephemeral = createClient(supabaseUrl, supabaseAnon, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: signUp, error: signUpErr } = await ephemeral.auth.signUp({
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
      // Supabase signUp does NOT throw an error when the email already exists
      // (so that you can't probe which emails are registered). Instead, it
      // returns a user object with an empty `identities` array. Detect that
      // here, otherwise we'd silently overwrite the existing customer's
      // profile (name/credit_limit/is_active) with the new owner-supplied
      // values without actually changing the password.
      if (!signUp.user?.identities?.length) {
        throw new Error("A customer with this phone already exists.");
      }
      const userId = signUp.user?.id;
      if (!userId) throw new Error("Failed to create user.");

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
