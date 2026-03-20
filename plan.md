# ZimFeast Platform Fix & Migration Plan

## Context

ZimFeast has critical backend bugs, missing validation, no tests, incomplete driver app features, and a React/Vite frontend that needs to migrate to Next.js. This unified plan addresses everything — backend hardening, Next.js migration (with frontend bugs fixed during migration), driver app completion, and test infrastructure.

**Key findings from codebase exploration:**
- Payment callback endpoints exist (`/result/` and `/callback/`) but lack idempotency/atomicity
- Driver app is ~80% done — login, delivery flow, location tracking, socket all work. Missing: earnings data, settings edit, order history
- Restaurant service uses Daphne (single-process) — needs Gunicorn+Uvicorn for production
- THREE duplicate `apiRequest` functions exist — consolidated into one during Next.js migration
- Frontend bugs (hardcoded checkout orderId, cart multi-restaurant, monolithic CustomerApp) are fixed during migration instead of patching the old Vite app

---

## Phase 1: Backend Critical Fixes (all parallel)

> These are independent of the frontend and must ship first. All 5 tasks touch different services and can run in parallel.

### Task 1: Order Status Transition Validation
**Complexity: M | Files: 1**

File: `backend/order-service/internal/handlers/orders.go`

- Add a `validTransitions` map above `UpdateStatus()`:
  ```
  pending_payment → [paid, cancelled]
  paid → [preparing, cancelled]
  preparing → [ready]
  ready → [collected]
  collected → [assigned]
  assigned → [out_for_delivery]
  out_for_delivery → [delivered]
  ```
- In `UpdateStatus()` (line 427), before the SQL update:
  1. SELECT current status: `SELECT status FROM orders_order WHERE id = $1`
  2. Check `validTransitions[currentStatus]` contains `body.Status`
  3. Return 400 `"Cannot transition from {current} to {requested}"` if invalid
- Add helper: `func isValidTransition(from, to string) bool`
- `CancelOrder()` (line 261) already validates correctly — no changes needed

### Task 2: Payment Callback Robustness
**Complexity: M | Files: 2**

Files:
- `backend/payment-service/payments/views.py`
- `backend/payment-service/payments/models.py`

Changes:
1. **Idempotency**: In both `paynow_result()` (line 305) and `paynow_callback()` (line 328), check `if payment.status == "paid": return Response({"status": "already processed"})` before doing anything
2. **Atomic update**: Use `Payment.objects.select_for_update().get(reference=reference)` inside `transaction.atomic()` to prevent race conditions between the two callback endpoints
3. **Consolidate**: Extract common logic into `_process_payment_callback(reference, status_pay)` that both views call
4. **Add `processed_at`**: Add nullable `DateTimeField` to Payment model, set it when callback succeeds. Run `makemigrations` + `migrate`
5. **Error resilience**: Wrap `_update_order_status()` and `_record_earning()` in try/except — log errors but still return 200 to Paynow (so it doesn't retry endlessly)

### Task 3: Realtime Service State Reconstruction
**Complexity: M | Files: 3**

Files:
- `backend/realtime-service/internal/driverservice.go`
- `backend/realtime-service/internal/orderservice.go`
- `backend/realtime-service/main.go`

**driverservice.go** — Add `RestoreFromRedis(ctx context.Context) error`:
1. `SMEMBERS drivers:online` → get all online driver IDs
2. For each: `HGETALL driver:{id}` → get name, phone, status, lat, lng
3. Populate `drivers` map. Set `SocketID = ""` (stale — drivers must reconnect)
4. Don't populate `sockets` map (connections are gone)
5. Redis GEO data (`drivers:locations`) persists automatically

**orderservice.go** — Add `RestoreFromRedis(ctx context.Context) error`:
1. `SCAN` with pattern `order:*` to find cached orders
2. `HGET order:{id} data` → unmarshal JSON into `ActiveOrder`
3. Only restore orders with status `finding_driver`, `driver_assigned`, or `out_for_delivery`
4. Populate `orders` map

**main.go** — After creating services (around line 33):
1. Call `driverSvc.RestoreFromRedis(context.Background())`
2. Call `orderSvc.RestoreFromRedis(context.Background())`
3. Log restored counts: `log.Printf("[startup] restored %d drivers, %d active orders", ...)`

### Task 4: Restaurant Service ASGI Upgrade
**Complexity: S | Files: 2**

Files:
- `backend/restaurant-service/Dockerfile`
- `backend/restaurant-service/requirements.txt`

Changes:
1. Add `uvicorn==0.34.0` to `requirements.txt` (gunicorn already at line 8)
2. Change Dockerfile CMD (line 21) from:
   `CMD ["daphne", "-b", "0.0.0.0", "-p", "8002", "config.asgi:application"]`
   to:
   `CMD ["gunicorn", "config.asgi:application", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8002", "--workers", "4"]`
3. Uvicorn workers handle both HTTP and WebSocket via ASGI, matching existing `ProtocolTypeRouter` in `config/asgi.py`

### Task 5: Rate Limiting
**Complexity: M | Files: 4+**

**Django (all 3 services):**

File: `backend/shared/base_settings.py`
- Add to `REST_FRAMEWORK` dict (line 61):
  ```python
  'DEFAULT_THROTTLE_CLASSES': [
      'rest_framework.throttling.AnonRateThrottle',
      'rest_framework.throttling.UserRateThrottle',
  ],
  'DEFAULT_THROTTLE_RATES': {
      'anon': '20/min',
      'user': '60/min',
      'login': '5/min',
  }
  ```

File: `backend/auth-service/accounts/views.py`
- Add custom throttle to login view:
  ```python
  from rest_framework.throttling import AnonRateThrottle
  class LoginRateThrottle(AnonRateThrottle):
      scope = 'login'
  ```
  Apply to `login()` and `register()` views

File: `backend/payment-service/payments/views.py`
- Exempt `paynow_result` and `paynow_callback` from user throttle (server-to-server from Paynow)
- Keep rate limiting on `create_payment` (user-facing)

**Go services:**

Files: `backend/order-service/main.go`, `backend/driver-service/main.go`
- Add `github.com/go-chi/httprate` to go.mod
- Add middleware: `r.Use(httprate.LimitByIP(100, 1*time.Minute))`
- For inter-service endpoints (X-Service-Key authenticated), use higher limit or bypass

---

## Phase 2: Backend Tests (after Phase 1)

### Task 6: Critical Path Tests
**Complexity: L | Files: 4+ new**

**Django tests:**

Create: `backend/auth-service/accounts/tests.py`
- Test registration (valid + duplicate email)
- Test login (valid + invalid credentials)
- Test profile fetch (authenticated + unauthenticated)
- Test rate limiting on login

Create: `backend/payment-service/payments/tests.py`
- Test payment creation (paynow, voucher, combined)
- Test callback idempotency (process twice, verify no double-processing)
- Test callback with atomic locking
- Test voucher deposit/withdrawal balance math

**Go tests:**

Create: `backend/order-service/internal/handlers/orders_test.go`
- Test order creation (valid + missing fields)
- Test ALL status transitions (valid + invalid per state machine)
- Test cancellation rules (only from pending_payment/paid)
- Use `httptest` + `chi` test server, mock DB with interface

Create: `backend/driver-service/internal/handlers/handlers_test.go`
- Test profile creation
- Test finance get/update
- Test location update

**Setup:**
- Add `pytest.ini` at `backend/` root for Django test discovery
- Each Go service can run `go test ./...`

---

## Phase 3: Next.js Migration + Frontend Bug Fixes (parallel with Phase 1)

> Instead of patching the old Vite app, we fix all frontend bugs during the migration. The old `webapp/` stays running until the new app is verified.

### Step 3.1: Project Setup
**Complexity: M**

- Scaffold new Next.js app: `npx create-next-app@latest webapp-next --typescript --tailwind --app --src-dir`
- Port config:
  - Tailwind config from `webapp/tailwind.config.ts`
  - Path aliases: `@/` → `webapp-next/src/`, `@shared/` → `shared/`
  - Environment variables: `VITE_*` → `NEXT_PUBLIC_*`
- Install all current dependencies: shadcn/ui, TanStack Query, Radix UI, socket.io-client, wouter (removed — Next.js handles routing)

### Step 3.2: Move Shared & Static Code
**Complexity: S**

- Copy `webapp/components/ui/` → `webapp-next/src/components/ui/` (shadcn — framework-agnostic, works as-is)
- Copy static assets from `webapp/public/` → `webapp-next/public/`
- **FIX (apiRequest consolidation):** Create ONE canonical `webapp-next/src/lib/apiRequest.ts` with the best-typed signature:
  ```typescript
  export async function apiRequest<T>(
    url: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    data?: any
  ): Promise<T>
  ```
  This replaces all 3 old implementations (`hooks/useAuth.ts`, `lib/queryClient.ts`, `driver-components/apiRequest.ts`). Every file in the new app imports from this single source.
- Copy and clean `lib/utils.ts`, `lib/authUtils.ts`
- Port `lib/queryClient.ts` — keep `getQueryFn` and `queryClient` setup, remove the old `apiRequest` (now imported)

### Step 3.3: Routing Conversion
**Complexity: M**

Convert Wouter/React Router routes to Next.js file-based routes. Each route in `webapp/App.tsx` becomes a folder in `app/`:

```
/                          → app/page.tsx              (Landing)
/home                      → app/home/page.tsx         (Home/Portal)
/login                     → app/login/page.tsx
/register                  → app/register/page.tsx
/customer                  → app/customer/page.tsx
/checkout                  → app/checkout/page.tsx
/payment-return            → app/payment-return/page.tsx
/restaurant/dashboard      → app/restaurant/dashboard/page.tsx
/driver                    → app/driver/page.tsx
/admin                     → app/admin/page.tsx
/admin/login               → app/admin/login/page.tsx
/admin/register            → app/admin/register/page.tsx
/admin/analytics           → app/admin/analytics/page.tsx
/business                  → app/business/page.tsx
```

- Replace all `<Link>` and `useLocation()` (wouter) with Next.js `next/link` and `useRouter()` from `next/navigation`
- Replace `useSearchParams` for query params (checkout orderId, etc.)

### Step 3.4: Page Migration (one page at a time)
**Complexity: L**

Mark all pages as `"use client"` initially — current app is fully client-rendered, start by making everything a Client Component to get running fast.

Migrate in priority order, fixing bugs as we go:

1. **Landing/Home** (highest traffic) — straightforward port
2. **Login/Register** (auth flow) — port useAuth hook, ensure token management works
3. **Customer App** (restaurant browsing, menu, cart, checkout):
   - **FIX (split CustomerApp):** Instead of porting the 424-line monolith, split into proper components + hooks:
     - `hooks/useCart.ts` — cart state, localStorage persistence, multi-restaurant check
     - `hooks/useRestaurants.ts` — restaurant fetching, pagination, filtering
     - `hooks/useActiveOrder.ts` — order polling, tracking state
     - `hooks/useUserLocation.ts` — geolocation logic
     - Customer page becomes ~100-120 lines of hook composition + JSX
   - **FIX (cart multi-restaurant):** Build into `useCart.ts` — when adding item from different restaurant, show confirmation dialog to clear cart
   - **FIX (checkout hardcoded orderId):** In checkout page, use `useSearchParams()` to get orderId. If missing, redirect to `/home`. No hardcoded fallback UUID.
4. **Restaurant Dashboard** — port with WebSocket consumer
5. **Driver web pages** — port with consolidated apiRequest
6. **Admin pages** — port last (lowest priority)

### Step 3.5: Hooks & State Management
**Complexity: M**

- Port custom hooks to `webapp-next/src/hooks/`:
  - `useAuth.ts` — JWT auth (add `"use client"`, import apiRequest from `@/lib/apiRequest`)
  - `useOrderSocket.ts` — Socket.IO for order tracking
  - `useWebSocket.ts` — general WebSocket
  - `use-toast.ts`, `use-mobile.tsx` — UI hooks
- Wrap app in `QueryClientProvider` inside a `providers.tsx` client component, referenced from `app/layout.tsx`
- **Replace role guards:** Convert `withRoleGuard` HOC → Next.js `middleware.ts` that checks JWT and redirects unauthorized users server-side

### Step 3.6: Leverage Next.js Features
**Complexity: M**

- **Auth middleware:** `middleware.ts` at root protects routes server-side before page loads
- **Server Components:** Convert Landing page and restaurant listing to Server Components for SEO + performance (fetch data server-side)
- **next/image:** Replace `<img>` tags for restaurant photos, logos with optimized loading
- **Metadata API:** Add per-page `<title>`, `<meta>` tags via `export const metadata` or `generateMetadata()`

### Step 3.7: API Layer
**Complexity: S**

- Replace `VITE_API_URL` with `NEXT_PUBLIC_API_URL` in all API calls
- Optional: Create `app/api/` proxy routes to hide backend URLs from browser and avoid CORS:
  - `app/api/orders/route.ts` → proxies to order-service
  - `app/api/auth/route.ts` → proxies to auth-service
  - etc.

### Step 3.8: Build & Deploy
**Complexity: M**

- Create new Dockerfile for Next.js:
  ```dockerfile
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:20-alpine AS runner
  WORKDIR /app
  COPY --from=builder /app/.next ./.next
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/package.json ./
  EXPOSE 3000
  CMD ["npm", "start"]
  ```
- Update `backend/docker-compose.yml` — point frontend service to new Dockerfile
- Update `backend/api-gateway/nginx.conf`:
  - Proxy `/` to Next.js server (port 3000) instead of serving static files
  - Keep `/api/*` routes unchanged

### Step 3.9: Cleanup
**Complexity: S**

- Remove old `webapp/` directory once new app is verified
- Update `CLAUDE.md` project structure to reflect `webapp-next/` (or rename to `webapp/`)
- Update path aliases and any CI/CD references

---

## Phase 4: Driver App Fixes (parallel with Phases 1-3)

> All driver app tasks are independent. Tasks 11-13 can run in parallel. Task 14 depends on Task 11.

### Task 7: Populate Earnings Tab
**Complexity: M | Files: 3**

Files:
- `driver-app/app/src/main/java/com/zimfeast/driver/data/api/ApiService.java`
- `driver-app/app/src/main/java/com/zimfeast/driver/data/model/DailyFinance.java` (new)
- `driver-app/app/src/main/java/com/zimfeast/driver/ui/MainActivity.java`

Changes:
1. Create `DailyFinance.java` model: `today_deliveries` (int), `today_earnings` (double), `today_tips` (double), `hours_online` (double), `average_rating` (double)
2. Add to `ApiService.java`: `@GET("api/drivers/daily/finances/") Call<DailyFinance> getDailyFinances();`
3. In `MainActivity.showEarnings()` (line 152): call API and bind to existing layout views:
   - `tv_total_earnings` → `$X.XX`
   - `tv_total_deliveries` → count
   - `tv_total_distance` → placeholder
   - `tv_total_tips` → tips
4. Add auto-refresh when earnings tab is selected

### Task 8: Settings Editing
**Complexity: S | Files: 2**

Files:
- `driver-app/app/src/main/java/com/zimfeast/driver/ui/MainActivity.java`
- `driver-app/app/src/main/res/layout/activity_main.xml`

Changes:
1. Add "Edit Profile" button in settings section of layout XML
2. On tap: show AlertDialog with EditText fields for phone and vehicle
3. On save: call `apiService.updateDriverProfile(updates)` (already in ApiService line 48)
4. On success: update displayed text + update SharedPreferences via `ZimFeastDriverApp`

### Task 9: Order History Activity
**Complexity: M | Files: 4 new + 2 modified**

Create:
- `driver-app/.../ui/OrderHistoryActivity.java` — calls `apiService.getDriverOrders()`, populates RecyclerView
- `driver-app/.../ui/OrderHistoryAdapter.java` — RecyclerView.Adapter for order items
- `driver-app/app/src/main/res/layout/activity_order_history.xml` — Toolbar + RecyclerView + empty state
- `driver-app/app/src/main/res/layout/item_order_history.xml` — CardView with order info

Modify:
- `driver-app/app/src/main/AndroidManifest.xml` — register OrderHistoryActivity
- `driver-app/.../ui/MainActivity.java` — add "View History" button in earnings tab to launch it

### Task 10: Driver Ratings Display
**Complexity: S | Files: 2 | Depends on: Task 7**

Files:
- `driver-app/.../ui/MainActivity.java`
- `driver-app/app/src/main/res/layout/activity_main.xml`

Changes:
1. `DriverProfile` model already has `rating` and `totalDeliveries` fields
2. `DailyFinance` response from Task 7 includes `average_rating`
3. Add rating display (star icon + numeric) in home tab header or earnings section
4. Fetch via `getDriverProfile()` on app load, display overall rating

---

## Execution Order

```
Phase 1 (parallel):    Task 1 + Task 2 + Task 3 + Task 4 + Task 5     [Backend fixes]
Phase 3.1-3.2:         Next.js setup + shared code + apiRequest fix     [Frontend migration start]
Phase 4A (parallel):   Task 7 + Task 8 + Task 9                        [Driver app]
                                    ↓
Phase 2:               Task 6                                           [Backend tests]
Phase 3.3-3.4:         Routing + page migration (bugs fixed inline)     [Frontend migration core]
Phase 4B:              Task 10                                          [Driver ratings]
                                    ↓
Phase 3.5-3.6:         Hooks, state, Next.js features                   [Frontend enhancement]
Phase 3.7-3.9:         API layer, Docker, cleanup                       [Frontend deploy]
```

**Parallelism:** Phases 1, 3.1-3.2, and 4A can all start simultaneously — they touch backend, frontend, and mobile respectively.

---

## Verification

### Backend (after Phase 1 + 2)
- `cd backend && docker compose up --build` — all services start healthy
- Test order status: try invalid transition (e.g., `pending_payment → delivered`) → expect 400
- Test payment callback: POST `/api/payments/callback/` twice with same reference → second returns "already processed"
- Restart realtime-service → verify driver count restored from Redis in logs
- Hit login 6 times in 1 minute → expect 429 throttled
- Run `pytest` in auth-service and payment-service → all pass
- Run `go test ./...` in order-service and driver-service → all pass

### Frontend (after Phase 3)
- `cd webapp-next && npm run build` — builds without errors
- Navigate to `/checkout` with no orderId param → redirects to `/home`
- Add item from Restaurant A, then try from Restaurant B → confirmation dialog appears
- All pages render correctly (landing, login, customer, restaurant, driver, admin)
- Auth middleware redirects unauthenticated users from protected routes
- Only ONE `apiRequest` import exists across the entire codebase
- Docker build succeeds and Next.js serves on port 3000 behind Nginx

### Driver App (after Phase 4)
- Open earnings tab → API call fires, numbers populate
- Settings → tap Edit → update phone → saves successfully
- Earnings → View History → shows past orders in RecyclerView
- Home screen shows rating stars
