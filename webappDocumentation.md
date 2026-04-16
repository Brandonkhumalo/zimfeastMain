# Webapp Documentation

This is the onboarding guide for the React frontend in `webapp/`.

## 1. Stack and Runtime

- React 18 + TypeScript
- Vite (dev/build)
- Wouter (routing)
- TanStack Query (server state)
- Tailwind CSS + Radix UI primitives
- Socket.IO client for realtime order tracking

Entry points:

- `webapp/main.tsx`
- `webapp/App.tsx`

## 2. Directory Map

```text
webapp/
├── App.tsx                     # Route tree + app providers
├── main.tsx                    # React root render
├── pages/                      # Top-level route pages
│   ├── admin/                  # New admin portal pages
│   ├── customer-components/    # Customer page sections
│   ├── driver-components/      # Driver page sections
│   ├── restaurant-components/  # Restaurant dashboard sections
│   └── ...
├── components/                 # Shared UI/business components
│   └── ui/                     # Base design-system primitives
├── hooks/                      # Shared hooks (auth, sockets, cart, etc.)
├── lib/                        # API client, query client, utilities
├── shared/                     # Shared domain helpers
├── index.css                   # Global styles
├── vite.config.ts
└── package.json
```

## 3. Routing and Role Access

Routing is defined in `App.tsx` with a `PrivateRoute` guard.

Public routes:

- `/` -> Landing
- `/login` -> Login
- `/register` -> Register
- `/business-hub` -> BusinessHub

Protected routes:

- `/home`
- `/customer`
- `/restaurant`
- `/driver`
- `/corporate`
- `/admin/*`

Other routes:

- `/checkout`
- `/payment-return`
- legacy admin routes under `/zimfeast/admin/*`

Role enforcement uses `useAuth()` and role checks before rendering protected screens.

## 4. Authentication and API Calling

Primary auth/data flow:

- `hooks/useAuth.ts` fetches `/api/accounts/profile/` if JWT token exists in localStorage.
- `lib/apiRequest.ts` is the canonical API utility.
- `apiRequest` handles JWT refresh automatically on `401` via `/api/accounts/refresh/`.
- If refresh fails, tokens are cleared and user is redirected to `/login`.

Token storage keys:

- `token` (access token)
- `refreshToken`

## 5. Data Fetching Pattern

Standard pattern:

1. Use `apiRequest` in hooks/pages
2. Use TanStack Query `useQuery`/`useMutation`
3. Keep query keys stable and role/user-scoped where needed
4. Invalidate/refetch from mutation callbacks

Shared query config lives in `lib/queryClient.ts`.

## 6. Realtime Integration

Main realtime hook:

- `hooks/useOrderSocket.ts`

Connection strategy:

- Uses `VITE_REALTIME_URL` if present.
- Otherwise uses localhost default in dev or window origin in hosted env.
- Joins `/customers` namespace and order-specific rooms.

Key socket events handled:

- `order:status`
- `order:driver_assigned`
- `driver:location`
- `order:completed`
- `order:no_drivers`

## 7. Environment and Config

Important env vars:

- `VITE_GOOGLE_MAPS_API_KEY` (used by `lib/loadGoogleMaps.ts`)
- `VITE_REALTIME_URL` (optional override)
- `VITE_API_URL` (currently empty in backend compose flow; frontend uses proxied relative paths)

`vite.config.ts` dev proxy routes:

- `/api` -> `http://0.0.0.0:8000`
- `/ws` -> `ws://0.0.0.0:8000`
- `/media` -> `http://0.0.0.0:8000`
- `/socket.io` -> `http://0.0.0.0:3001`

## 8. Local Setup

```bash
cd webapp
npm ci
npm run dev
```

Useful commands:

```bash
npm run build
npm run preview
npm run check
```

## 9. Feature Ownership by Area

- Customer journey: `pages/CustomerApp.tsx` + `pages/customer-components/*`
- Restaurant portal: `pages/RestaurantDashboard.tsx` + `pages/restaurant-components/*`
- Driver portal: `pages/DriverApp.tsx` + `pages/driver-components/*`
- Admin portal: `pages/admin/*`
- Corporate: `pages/CorporateDashboard.tsx`

If you are onboarding to one persona, start with that top-level page and follow imports inward.

## 10. Known Gaps and Risks

- Some frontend modules reference `/api/drivers/*` endpoints, but no dedicated backend driver service exists in this repo currently.
- `npm run check` currently reports pre-existing TypeScript issues in multiple pages/components.
- Build succeeds (`npm run build`) even while strict typecheck fails.

## 11. Recommended Frontend Workflow for New Hires

1. Run app and navigate each role route manually.
2. Read `App.tsx` and `hooks/useAuth.ts` first.
3. Read `lib/apiRequest.ts` to understand token refresh behavior.
4. For your assigned area, map page -> components -> hooks -> API endpoints.
5. Before large changes, define query keys and mutation invalidation strategy.
6. Validate with both `npm run build` and `npm run check`.

## 12. Coding Conventions in This Codebase

- Keep route/page-level logic in `pages/*` and move reusable UI to `components/*`.
- Reuse `apiRequest` instead of raw `fetch` unless there is a strong reason.
- Use typed interfaces for API responses close to usage sites.
- Prefer composable hooks for network + socket behavior.
- Keep role access explicit at route level.
