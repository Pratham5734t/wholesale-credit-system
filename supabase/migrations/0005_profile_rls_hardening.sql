-- Harden profile updates: prevent customers from self-promoting to owner or
-- altering their own credit_limit / is_active / role / phone.
--
-- Old policy `profiles_owner_update` was: USING (is_owner OR auth.uid()=id) with same WITH CHECK.
-- That let a customer call .update({role:'owner', credit_limit:999999}) on their own row.
-- Replace with: only owners can UPDATE profiles. Customers never need to update
-- their own profile in this app (they don't change name/phone/credit; the owner does).

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
  for update using (public.is_owner())
  with check (public.is_owner());
