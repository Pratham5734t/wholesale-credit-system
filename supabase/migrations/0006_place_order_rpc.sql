-- Atomic, server-side order placement with credit-limit enforcement.
--
-- Addresses Devin Review findings:
--   - Customer could bypass the client-side credit-limit check via direct API
--     (RLS only checked customer_id, not credit_limit).
--   - Two-step insert (orders, then order_items) could leave orphan order rows
--     if the items insert and cleanup delete both failed.
--
-- After this migration:
--   - Customers can only place orders via this RPC. Direct `INSERT INTO orders`
--     and `INSERT INTO order_items` are blocked by RLS for customers.
--   - The RPC validates credit limit and inserts both rows in a single
--     transaction; either everything succeeds or nothing does.
--   - Prices and names are looked up server-side from `products`, so even a
--     manipulated client payload can't underprice an item.

create or replace function public.place_order(
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_credit_limit numeric;
  v_total numeric;
  v_outstanding numeric;
  v_overage numeric;
  v_all_valid boolean;
  v_all_qty_valid boolean;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select role, credit_limit into v_role, v_credit_limit
    from public.profiles where id = v_user_id;

  if v_role is distinct from 'customer' then
    raise exception 'NOT_A_CUSTOMER' using errcode = 'P0001';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  -- Look every item up server-side. Compute the total ourselves (don't trust
  -- the client-supplied price). Any unknown / inactive product fails.
  with items_lookup as (
    select
      (i.elem->>'product_id')::uuid as product_id,
      (i.elem->>'quantity')::int as quantity,
      p.name as name_snapshot,
      p.price as price_snapshot,
      coalesce(p.is_active, false) as is_active
    from jsonb_array_elements(p_items) as i(elem)
    left join public.products p on p.id = (i.elem->>'product_id')::uuid
  )
  select
    coalesce(sum(price_snapshot * quantity), 0),
    bool_and(price_snapshot is not null and is_active),
    bool_and(quantity is not null and quantity > 0)
    into v_total, v_all_valid, v_all_qty_valid
  from items_lookup;

  if not v_all_valid then
    raise exception 'PRODUCT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not v_all_qty_valid then
    raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
  end if;

  -- Outstanding mirrors customer_balance(): only confirmed/delivered orders
  -- count toward what the customer owes. Pending orders are not yet "charged".
  select
    coalesce(
      (select sum(o.total) from public.orders o
        where o.customer_id = v_user_id
          and o.status in ('confirmed', 'delivered')),
      0
    )
    -
    coalesce(
      (select sum(p.amount) from public.payments p
        where p.customer_id = v_user_id),
      0
    )
    into v_outstanding;

  if v_outstanding + v_total > v_credit_limit then
    v_overage := (v_outstanding + v_total) - v_credit_limit;
    raise exception 'CREDIT_LIMIT_EXCEEDED:%', v_overage using errcode = 'P0001';
  end if;

  insert into public.orders (customer_id, status, total, notes)
  values (v_user_id, 'pending', v_total, p_notes)
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, name_snapshot, price_snapshot, quantity, line_total)
  select
    v_order_id,
    (i.elem->>'product_id')::uuid,
    p.name,
    p.price,
    (i.elem->>'quantity')::int,
    p.price * (i.elem->>'quantity')::int
  from jsonb_array_elements(p_items) as i(elem)
  join public.products p on p.id = (i.elem->>'product_id')::uuid;

  return v_order_id;
end;
$$;

grant execute on function public.place_order(text, jsonb) to authenticated;

-- Block direct customer INSERTs so the RPC is the only path. The RPC runs
-- security-definer and therefore bypasses RLS for the actual writes.
drop policy if exists orders_customer_insert on public.orders;
create policy orders_customer_insert on public.orders
  for insert with check (public.is_owner());

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert with check (public.is_owner());
