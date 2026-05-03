---
name: testing-wholesale-credit
description: How to test, debug, and extend the Wholesale Credit System (React + Vite + Supabase). Covers preview URL, auth quirks, synthetic-email mapping, the place_order RPC, and migration commands. Read before making changes to auth, orders, or credit-limit logic.
---

# Testing the Wholesale Credit System

## Live preview
- URL: https://dist-rupnmpys.devinapps.com
- Built with Netlify-style static deploy of `npm run build` output (`dist/`).
- Wired to a real Supabase project — every action mutates the DB.

## Owner credentials (for testing)
- Phone: `9156088616`
- Password: `Pass@2020`
- Real owner is the user; do NOT change this password without coordination.

## Phone-to-email mapping (synthetic auth)
The app maps phone numbers to synthetic emails to avoid SMS/OTP costs:
`<phone>@example.com` (e.g. `9876543210@example.com`).

`example.com` is RFC 2606 reserved (IANA-owned, never expires) with a **null-MX record** so Supabase's signUp domain validation passes but emails are guaranteed undeliverable. Do NOT change `VITE_PHONE_EMAIL_DOMAIN` to a made-up TLD — Supabase will reject signUp with `Email address is invalid`. Safe alternatives: `example.org`, `example.net`. Unsafe: `.test`, `.local`, `.invalid` (no MX), or any made-up TLD.

If migrating an existing project to a new domain, update existing users via SQL — `signIn` does not re-validate the domain so old logins keep working:
```sql
UPDATE auth.users SET email = REPLACE(email, '@old.tld', '@example.com')
WHERE email LIKE '%@old.tld';
```

## Required Supabase Auth settings
**"Confirm email" must be OFF** (Dashboard → Authentication → Providers → Email → toggle).

Verify via API:
```bash
curl -s https://<project>.supabase.co/auth/v1/settings -H 'apikey: <anon>' | jq .mailer_autoconfirm
# expect: true
```
If `false`, every customer signup hangs waiting for a confirmation link the user never receives. The toggle is a GoTrue config and cannot be changed via SQL.

## Local dev
```bash
npm install
npm run dev      # Vite, port 5173
npm run lint     # ESLint
npm run build    # Production build into dist/
```
Requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `.env` is gitignored — never commit secrets. `.env.example` is the committed template.

## Database migrations
Migrations live in `supabase/migrations/*.sql`. Apply against the live DB via the pooler:
```bash
export PGPASSWORD='<db_password>'
psql "host=aws-1-ap-south-1.pooler.supabase.com port=5432 \
      user=postgres.<project_ref> dbname=postgres sslmode=require" \
     -f supabase/migrations/000X_<name>.sql
```
Note: the pooler hostname is `aws-1-ap-south-1.pooler.supabase.com` (with the `1` prefix), NOT `aws-ap-south-1.pooler.supabase.com`. Direct DB hostnames will fail SSL handshake from this VM — always use the pooler.

## Key code paths

### Credit-limit enforcement (the most security-critical logic)
- **Server-side authority**: `supabase/migrations/0006_place_order_rpc.sql` defines `place_order(p_notes, p_items)` which is the ONLY way to insert into `orders` / `order_items`. RLS blocks direct INSERTs. The RPC re-looks up product prices server-side (no client price tampering) and atomically validates that `outstanding + new_total <= credit_limit`.
- **Client UX**: `src/pages/CartPage.tsx` shows an inline red banner and disables the Place-order button as soon as `cart_total + outstanding > credit_limit`. There is no toast on click — the click is impossible because the button is disabled. This is intentional.
- **Balance source of truth**: `customer_balance(p_customer_id)` SQL function (returns `charged`, `paid`, `outstanding`). NEVER compute balance client-side by summing rows — Supabase's `select` truncates to 1000 rows by default which silently undercounts.

### Order placement is atomic
`place_order()` inserts the order header AND all order_items in a single transaction. There is NO orphan-row cleanup path — either both succeed or both roll back. Do not introduce a two-step insert here.

### RLS profile hardening
`supabase/migrations/0005_profile_rls_hardening.sql` restricts `update profiles` to owners only. Customers cannot self-promote to owner or change their own credit_limit. Test this by trying `await supabase.from('profiles').update({role:'owner'}).eq('id', auth.uid())` from a customer session — should return 0 rows / RLS denied.

### Customer signUp uses an ephemeral Supabase client
`src/queries/customers.ts` creates a NEW Supabase client with `persistSession:false` for the `auth.signUp` call when the owner creates a customer. This prevents the signUp from hijacking the owner's session and bouncing them out of `/admin`. Do not refactor this to use the shared client.

### Cart clears on sign-out
`src/contexts/CartContext.tsx` listens to `supabase.auth.onAuthStateChange` and clears `localStorage['wcs_cart_v1']` on `SIGNED_OUT`. Without this, customer A's cart persists into customer B's session.

## Testing tips
- The DB is shared between dev and the live preview. To start a clean test: delete all customer profiles, products, orders, payments. Owner profile must remain.
- The owner role is computed from `profiles.role = 'owner'`. To check a user's role: `select role from profiles where id = '<uuid>'`.
- For E2E flows, prefer the recorded GUI test approach (see test-plan.md / test-report.md for the canonical flow). Single continuous recording, annotate at each step boundary.
- Post-recording SQL verification is essential: assert `customer_balance` RPC returns the expected charged/paid/outstanding tuple, and that no orphan order/order_items rows exist.

## Common gotchas
- `order_items.quantity` (NOT `qty`), `order_items.price_snapshot` (NOT `unit_price`), `order_items.name_snapshot` (NOT `product_name`). The schema uses snapshot suffixes because product names/prices may change after an order is placed.
- Supabase's `signUp` returns a user object with `identities: []` for duplicate emails (instead of throwing). `src/queries/customers.ts` checks `if (!signUp.user?.identities?.length) throw new Error('A customer with this phone already exists.')` — preserve this guard.
- `mailer_autoconfirm` cannot be toggled via SQL or the management API — it requires manual toggle in the Supabase dashboard or use of the GoTrue admin API with a service-role key.
