# Wholesale Credit System

A simple, mobile-friendly web app for running a wholesale business on credit. Owner adds products and customers; customers browse and place orders; everything runs on a credit ledger (no online payments).

**Stack:** React + Vite + TypeScript + Tailwind CSS · Supabase (Postgres + Auth + Storage + RLS) · React Router · TanStack Query · Netlify hosting.

## Features

**Owner**
- Add / edit / delete products with image, price, description, optional stock
- Manage customers — phone, name, password, credit limit
- View incoming orders and confirm / deliver / cancel them
- Per-customer ledger with running balance, full order history, and payment history
- Record customer payments with optional notes
- Dashboard: pending orders, today's orders, total outstanding, customers at credit limit

**Customer**
- Log in with phone + password (set by the owner — no SMS / OTP costs)
- Browse the product catalog, search, add to cart
- Place an order — blocked if it would exceed the credit limit
- See own order history with statuses
- See own credit limit, current outstanding, available credit, payment history

## Quick start

```bash
git clone https://github.com/Pratham5734t/wholesale-credit-system.git
cd wholesale-credit-system
npm install
cp .env.example .env       # then fill in your Supabase URL + anon key
npm run dev
```

Open http://localhost:5173.

## Setup — Supabase

1. Create a Supabase project at https://supabase.com (free tier is fine).
2. In the dashboard go to **Project Settings → API** and copy:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
3. Open the **SQL Editor** and run, in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_storage.sql`
4. **Disable email confirmation** so customer accounts work immediately:
   **Authentication → Providers → Email** → turn **Confirm email** OFF.
5. **Create your owner account.** In **Authentication → Users → Add user → Create new user**:
   - Email: `<your10digitphone>@wholesale.local`  (e.g. `9876543210@wholesale.local`)
   - Password: whatever you want — this is what you'll use to log in
   - **Auto Confirm User: YES**
6. **Promote your account to owner.** Open `supabase/seed.sql`, replace the phone with yours, and run it in the SQL Editor.

You can now log into the app at `/login` with **phone = `9876543210`** and your password.

### Why "phone + password" without SMS

Supabase's built-in phone+OTP auth requires an SMS provider (Twilio, MessageBird, etc.) which costs money. We don't need OTP because the owner sets every customer's password manually. Internally we register every account as `<phone>@wholesale.local` in Supabase Auth, but the user only ever types phone + password. Free, fast, and works.

## Setup — Netlify

1. Push this repo to GitHub.
2. On https://app.netlify.com, **Add new site → Import existing project** → pick this repo.
3. Build settings (Netlify reads `netlify.toml` automatically):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Trigger a deploy.

That's it — your customers can hit the public URL on any phone or laptop.

## Day-to-day usage

**Adding a customer**
- `/admin/customers → + Add customer`. Set their name, phone, a password to give them, and a credit limit.
- Tell them: *"Open this link, log in with your phone and the password I set."*

**Customer places an order**
- Customer browses `/shop`, adds to cart, places the order. If the order would exceed their credit limit they get blocked with a clear message.

**You confirm and deliver**
- `/admin/orders` → see new orders. Click **Confirm**, then **Mark delivered** when delivered.
- The order's total only counts against the customer's outstanding once it's confirmed/delivered (cancelled orders don't count).

**They pay you**
- `/admin/customers/:id → Record payment`. Enter the amount and an optional note (e.g. "cash", "UPI"). Their balance updates immediately.

## Roadmap (easy to add later)

- WhatsApp notifications on new orders (via `wa.me/<your-number>?text=...` link or Twilio/Meta Cloud API)
- Online payments (Razorpay / Stripe) for those customers who want it
- Native mobile apps (Capacitor wrap of the same React code)
- Auto stock decrement on order confirmation
- GST invoices / printing
- Multi-language UI (Marathi / Hindi / English)

## Project layout

```
src/
  components/
    ui/                   small UI primitives (Button, Input, Card, ...)
    Layout.tsx            top nav + page shell
    ProtectedRoute.tsx    role-based route guard
  contexts/
    AuthContext.tsx       session + profile + signIn/signOut
    CartContext.tsx       customer cart, persisted to localStorage
  lib/
    supabase.ts           Supabase client
    database.types.ts     hand-written DB types
    phone.ts              phone <-> email mapping
    format.ts             ₹ formatting + dates
  pages/
    LoginPage.tsx
    customer/             ShopPage, CartPage, MyOrdersPage, MyAccountPage
    admin/                AdminDashboardPage, AdminProductsPage,
                          AdminCustomersPage, AdminCustomerDetailPage,
                          AdminOrdersPage
  queries/                TanStack Query hooks per entity
  router.tsx
  App.tsx
  main.tsx

supabase/
  migrations/             schema + RLS + storage policies
  seed.sql                one-shot owner promotion script
```

## License

Private — all rights reserved by the project owner.
