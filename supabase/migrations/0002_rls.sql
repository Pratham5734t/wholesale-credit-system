-- Row Level Security policies.

-- Helper: is the current user an owner?
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- Enable RLS on every table.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

-- =========================================================================
-- profiles
-- =========================================================================
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (
    auth.uid() = id or public.is_owner()
  );

drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles
  for insert with check (
    public.is_owner() or auth.uid() = id
  );

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
  for update using (public.is_owner() or auth.uid() = id)
  with check (public.is_owner() or auth.uid() = id);

drop policy if exists profiles_owner_delete on public.profiles;
create policy profiles_owner_delete on public.profiles
  for delete using (public.is_owner());

-- =========================================================================
-- products
-- =========================================================================
drop policy if exists products_read_all_active on public.products;
create policy products_read_all_active on public.products
  for select using (is_active or public.is_owner());

drop policy if exists products_owner_write on public.products;
create policy products_owner_write on public.products
  for all using (public.is_owner()) with check (public.is_owner());

-- =========================================================================
-- orders
-- =========================================================================
drop policy if exists orders_read_own_or_owner on public.orders;
create policy orders_read_own_or_owner on public.orders
  for select using (customer_id = auth.uid() or public.is_owner());

-- Customer can place their own order.
drop policy if exists orders_customer_insert on public.orders;
create policy orders_customer_insert on public.orders
  for insert with check (
    customer_id = auth.uid() or public.is_owner()
  );

-- Only owner can update/delete orders (status changes).
drop policy if exists orders_owner_update on public.orders;
create policy orders_owner_update on public.orders
  for update using (public.is_owner()) with check (public.is_owner());

drop policy if exists orders_owner_delete on public.orders;
create policy orders_owner_delete on public.orders
  for delete using (public.is_owner());

-- =========================================================================
-- order_items
-- =========================================================================
drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
  for select using (
    public.is_owner() or
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid()
    )
  );

-- Customer can add items only to their own pending orders they just inserted.
drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert with check (
    public.is_owner() or
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid() and o.status = 'pending'
    )
  );

drop policy if exists order_items_owner_modify on public.order_items;
create policy order_items_owner_modify on public.order_items
  for update using (public.is_owner()) with check (public.is_owner());

drop policy if exists order_items_owner_delete on public.order_items;
create policy order_items_owner_delete on public.order_items
  for delete using (public.is_owner());

-- =========================================================================
-- payments
-- =========================================================================
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
  for select using (
    customer_id = auth.uid() or public.is_owner()
  );

drop policy if exists payments_owner_write on public.payments;
create policy payments_owner_write on public.payments
  for all using (public.is_owner()) with check (public.is_owner());
