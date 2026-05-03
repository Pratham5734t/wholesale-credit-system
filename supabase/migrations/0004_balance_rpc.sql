-- Migration 0004: balance RPCs + customer cleanup policy.
-- Addresses Devin Review findings:
--   - balance computed in SQL with SUM (no PostgREST 1000-row truncation)
--   - customer can delete their own pending order (so cleanup of an orphan
--     order succeeds when order_items insert fails mid-placement).

-- =========================================================================
-- 1) RLS policy: customer can delete their OWN PENDING orders.
-- =========================================================================
drop policy if exists orders_customer_delete_pending on public.orders;
create policy orders_customer_delete_pending on public.orders
  for delete using (
    customer_id = auth.uid() and status = 'pending'
  );

-- =========================================================================
-- 2) Per-customer balance RPC (server-side SUM).
-- =========================================================================
create or replace function public.customer_balance(p_customer_id uuid)
returns table (
  customer_id uuid,
  charged numeric,
  paid numeric,
  outstanding numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  -- RLS check: caller must either be the customer or an owner.
  if not (auth.uid() = p_customer_id or public.is_owner()) then
    raise exception 'not_authorized';
  end if;

  return query
  select
    p_customer_id,
    coalesce((
      select sum(o.total)
      from public.orders o
      where o.customer_id = p_customer_id
        and o.status in ('confirmed', 'delivered')
    ), 0)::numeric as charged,
    coalesce((
      select sum(p.amount) from public.payments p
      where p.customer_id = p_customer_id
    ), 0)::numeric as paid,
    coalesce((
      select sum(o.total)
      from public.orders o
      where o.customer_id = p_customer_id
        and o.status in ('confirmed', 'delivered')
    ), 0)::numeric
    -
    coalesce((
      select sum(p.amount) from public.payments p
      where p.customer_id = p_customer_id
    ), 0)::numeric as outstanding;
end;
$$;

grant execute on function public.customer_balance(uuid) to authenticated;

-- =========================================================================
-- 3) All-customers balance RPC (owner-only). Returns one row per customer.
-- =========================================================================
create or replace function public.all_customer_balances()
returns table (
  customer_id uuid,
  charged numeric,
  paid numeric,
  outstanding numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'not_authorized';
  end if;

  return query
  with charged_per_customer as (
    select o.customer_id, sum(o.total) as charged
    from public.orders o
    where o.status in ('confirmed', 'delivered')
    group by o.customer_id
  ),
  paid_per_customer as (
    select p.customer_id, sum(p.amount) as paid
    from public.payments p
    group by p.customer_id
  )
  select
    pr.id as customer_id,
    coalesce(c.charged, 0)::numeric as charged,
    coalesce(pp.paid, 0)::numeric as paid,
    (coalesce(c.charged, 0) - coalesce(pp.paid, 0))::numeric as outstanding
  from public.profiles pr
  left join charged_per_customer c on c.customer_id = pr.id
  left join paid_per_customer pp on pp.customer_id = pr.id
  where pr.role = 'customer';
end;
$$;

grant execute on function public.all_customer_balances() to authenticated;
