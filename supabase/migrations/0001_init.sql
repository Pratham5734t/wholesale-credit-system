-- Wholesale Credit System — initial schema.
-- Run this in the Supabase SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type profile_role as enum ('owner', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'confirmed', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

-- Profiles (1:1 with auth.users).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role profile_role not null default 'customer',
  name text not null default '',
  phone text not null default '',
  credit_limit numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_phone_unique on public.profiles(phone) where phone <> '';
create index if not exists profiles_role_idx on public.profiles(role);

-- Auto-create a default 'customer' profile when an auth user is created.
-- The owner can later promote a profile to 'owner' via SQL.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_name text;
begin
  -- Phone is the local-part of the synthetic email.
  v_phone := split_part(new.email, '@', 1);
  v_name := coalesce(new.raw_user_meta_data->>'name', '');

  insert into public.profiles (id, role, name, phone, credit_limit, is_active)
  values (new.id, 'customer', v_name, v_phone, 0, true)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  stock integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_active_idx on public.products(is_active, created_at desc);

-- Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  status order_status not null default 'pending',
  total numeric(12,2) not null default 0 check (total >= 0),
  notes text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  delivered_at timestamptz
);
create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status, created_at desc);

-- Order items
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  price_snapshot numeric(12,2) not null check (price_snapshot >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payments_customer_idx on public.payments(customer_id, created_at desc);
