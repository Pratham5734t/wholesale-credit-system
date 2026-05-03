-- Seed your owner account.
--
-- HOW TO USE
-- ----------
-- 1) In the Supabase dashboard: Authentication → Users → Add user → Create new user.
--    - Email:    <your10digitphone>@wholesalecredit.app  (e.g. 9876543210@wholesalecredit.app)
--    - Password: whatever you want
--    - Auto Confirm User: YES
--
--    A 'customer' profile row will be auto-inserted by the trigger.
--
-- 2) Promote yourself to owner. Replace the phone with yours and run this:

update public.profiles
set role = 'owner',
    name = 'Owner',
    credit_limit = 0,
    phone = '9876543210'
where id = (
  select id from auth.users where email = '9876543210@wholesalecredit.app'
);

-- That's it. Log into the app with phone `9876543210` + your password.
-- You can also create a few sample products this way:

-- insert into public.products (name, description, price, is_active)
-- values
--   ('Sample Soap',  '500g pack of laundry soap',  45.00, true),
--   ('Sample Atta',  '10kg bag of wheat flour',   480.00, true),
--   ('Sample Sugar', '1kg pack',                   55.00, true);
