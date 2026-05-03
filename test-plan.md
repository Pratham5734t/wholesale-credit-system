# Test Plan — Wholesale Credit System (PR #1)

## What changed (user-visible)
First end-to-end scaffold of the app. Owner can manage products + customers; customers can place orders against a credit limit; owner confirms/delivers and records payments.

## Primary E2E flow (one continuous recording)
Goal: prove the **full happy path + credit-limit enforcement** works on the live preview wired to the user's real Supabase project.

Environment:
- Preview URL: `https://dist-rupnmpys.devinapps.com`
- Owner login: `9156088616` / `Pass@2020`
- Will create a fresh customer named **"Test Buyer"** with phone `9876500001`, password `cust@2020`, credit limit **₹500** (deliberately small so we can trigger the over-limit path)
- Test product: name `Atta 5kg`, price **₹200**, stock 100

Code references that informed this plan:
- `src/pages/LoginPage.tsx:25-45` — phone+password form, validation, redirect by role
- `src/pages/admin/AdminProductsPage.tsx:91-113` — product create with optional image upload
- `src/pages/admin/AdminCustomersPage.tsx:62-75` — customer create flow (calls `useCreateCustomer`)
- `src/queries/customers.ts:57-117` — uses `supabase.auth.signUp` then upserts profile (fails if "Confirm email" still on)
- `src/pages/customer/CartPage.tsx:23-78` — credit-limit guard with `balanceUnknown` + `overLimit` flags
- `src/pages/admin/AdminOrdersPage.tsx:113-132` — Confirm / Cancel buttons appear only for `pending` orders

### Steps + concrete pass/fail assertions

#### 1. Owner login
- Open `/login`, enter `9156088616` + `Pass@2020`, click **Sign in**.
- **Pass**: redirected to `/admin` and dashboard heading "Dashboard" is visible. Browser URL is `/admin`.
- **Fail**: stays on `/login` or shows error banner.

#### 2. Add a product (with image)
- Navigate to **Products** → click **+ Add product**.
- Fill name=`Atta 5kg`, price=`200`, stock=`100`, upload any small image (`/tmp/atta.png` — I'll generate one).
- **Pass**: toast "Product added." appears, modal closes, product card with name "Atta 5kg" and price "₹200" shows up in the list with the uploaded image rendering (not the 📦 placeholder).
- **Fail**: toast error, or product appears without image, or image broken (404).

#### 3. Add a customer
- Navigate to **Customers** → **+ Add customer**.
- name=`Test Buyer`, phone=`9876500001`, password=`cust@2020`, credit_limit=`500`.
- **Pass**: toast "Customer created." and a card titled "Test Buyer" with credit limit "₹500" appears.
- **Fail with "Email not confirmed"** → known dependency: user must toggle Confirm email OFF in Supabase. Will pause and ask.
- **Fail any other reason**: investigate.

#### 4. Customer login
- Click owner avatar → **Sign out**. From `/login` enter `9876500001` + `cust@2020`.
- **Pass**: redirected to `/shop`, page shows "Atta 5kg" with price "₹200".
- **Fail**: stays on `/login` or wrong page.

#### 5. CREDIT-LIMIT EDGE: cart blocks over-limit order
- Set quantity to **3** (= ₹600, exceeds ₹500 limit).
- **Pass — three things must all be true**:
  1. Place-order button is **disabled** (cannot click), OR clicking it shows toast `This order would put you over your credit limit. Clear ₹100 to continue.` (exact text from `CartPage.tsx:55-58`).
  2. Cart summary shows `₹600` total and an "Available credit: ₹500" or similar overage indicator.
  3. **No** new row appears in `orders` table (will verify via SQL after recording).
- **Fail**: order goes through despite exceeding limit (= the bug Devin Review flagged in #2).

#### 6. Place valid order
- Reduce quantity to **2** (= ₹400, within limit).
- Click **Place order**.
- **Pass**: redirected to `/my-orders`, toast "Order placed!", order card shows status badge `pending` and total `₹400`.
- **Fail**: error toast or order doesn't appear.

#### 7. Owner confirms order
- Sign out, log back in as owner. Go to **Orders**.
- Locate the new order. **Confirm** button should be visible (per `AdminOrdersPage.tsx:113-122`).
- Click **Confirm**.
- **Pass**: status badge changes from `pending` to `confirmed`, toast "Order confirmed.", and the Confirm/Cancel buttons disappear (replaced by Mark delivered, per next-status logic).
- **Fail**: order status stays `pending` or buttons don't update.

#### 8. Owner records payment + balance updates via RPC
- Go to **Customers** → click "Test Buyer" → on customer detail page, click **Record payment**.
- Enter amount `400` and save.
- **Pass — three things must all be true**:
  1. Toast "Payment recorded."
  2. Outstanding shown for customer drops from **₹400** to **₹0**.
  3. Customers list page no longer shows the "At limit" badge (since outstanding=0).
- **Fail**: outstanding doesn't drop, or shows stale 400, or shows negative.
- **Why this is adversarial for the RPC fix (Devin Review #3)**: the balance value is sourced from the new SQL RPC `customer_balance` (per `src/queries/balance.ts:27-36`). If the RPC were missing or broken, the page would show stale or zero values. Seeing `₹400 → ₹0` proves the RPC chain (charged - paid) is wired end-to-end.

### Post-recording SQL verification (proves no orphan orders, RPC accuracy)
```sql
-- Should show 1 order, status=confirmed, total=400
SELECT status, total FROM public.orders WHERE customer_id = (
  SELECT id FROM public.profiles WHERE phone='9876500001'
);

-- RPC sanity check: charged 400, paid 400, outstanding 0
SELECT * FROM public.customer_balance(
  (SELECT id FROM public.profiles WHERE phone='9876500001')
);
```
- **Pass**: exactly one row from each query with the expected values.
- **Fail**: zero or multiple orders (orphan-order bug regressed), or balance mismatch (RPC bug).

## What I am explicitly NOT testing (out of scope for this run)
- Stock auto-decrement (intentionally not implemented).
- WhatsApp notifications (out of v1).
- "Mark delivered" button beyond visual confirmation that it appears after confirm.
- Image upload edge cases (huge files, non-image MIME types).
- Mobile responsive breakpoints.

## Recording strategy
One continuous recording covering steps 1–8. `annotate_recording` markers at each step boundary. Maximize browser before recording. Post-recording SQL verification done in a separate shell-tool call (no recording needed).
