-- Storage bucket for product images.
-- Anyone can read; only the owner can upload/update/delete.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "Owner can write product images" on storage.objects;
create policy "Owner can write product images" on storage.objects
  for insert with check (
    bucket_id = 'product-images' and public.is_owner()
  );

drop policy if exists "Owner can update product images" on storage.objects;
create policy "Owner can update product images" on storage.objects
  for update using (
    bucket_id = 'product-images' and public.is_owner()
  ) with check (
    bucket_id = 'product-images' and public.is_owner()
  );

drop policy if exists "Owner can delete product images" on storage.objects;
create policy "Owner can delete product images" on storage.objects
  for delete using (
    bucket_id = 'product-images' and public.is_owner()
  );
