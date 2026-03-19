# Architectural Patterns & Conventions

## Three-Service Architecture

ZimFeast runs as three independent services communicating via HTTP and Redis Pub/Sub:

1. **React Frontend** (Vite, port 5000) - SPA with role-based views
2. **Django Backend** (Daphne ASGI, port 8000) - REST API + WebSocket via Channels
3. **Node.js Real-Time Server** (Express + Socket.IO, port 3001) - live tracking

Communication flow:
- Frontend -> Backend: HTTP REST (JWT auth)
- Frontend <-> Real-Time Server: Socket.IO (namespaces: `/drivers`, `/customers`)
- Backend -> Real-Time Server: Redis Pub/Sub (`realtime/publishers.py`)
- Real-Time Server -> Backend: HTTP API (driver assignments)

Reference: [vite.config.ts:10-27](vite.config.ts) (proxy config), [real-time-server/src/index.js:26-57](real-time-server/src/index.js) (Redis + service init)

---

## State Management

### Frontend Data Fetching - TanStack Query
- All server state managed via React Query with a custom `queryFn` that injects JWT tokens
- Query keys match API endpoint paths: `queryKey: ['/api/restaurants']`
- Conditional fetching via `enabled` flag
- Cache invalidation on mutations via `queryClient.invalidateQueries`

Reference: [src/lib/queryClient.ts:11-64](src/lib/queryClient.ts) (custom query function with auth)

### Local State
- Component-level: `useState`/`useEffect`
- Cart persistence: `localStorage` in [src/pages/CustomerApp.tsx:40-47](src/pages/CustomerApp.tsx)
- No global state library (no Redux/Zustand)

### Real-Time State
- `useOrderSocket` hook manages WebSocket connection lifecycle and order status
- Reference: [src/hooks/useOrderSocket.ts:33-145](src/hooks/useOrderSocket.ts)

---

## Authentication Pattern

### JWT Implementation (Custom, not django-rest-framework-simplejwt)
- Custom token generation/validation: [ZimFeast/accounts/token.py:17-86](ZimFeast/accounts/token.py)
- Access token: 14-day expiry, Refresh token: 30-day expiry
- Token stored in `localStorage` under key `"token"`
- Auto-injected via `apiRequest()` helper: [src/lib/queryClient.ts:11-29](src/lib/queryClient.ts)
- Token blacklist model for logout: [ZimFeast/accounts/models.py:53-57](ZimFeast/accounts/models.py)

### Route Protection
- Frontend: `withRoleGuard` HOC wraps protected pages: [src/lib/withRoleGuard.tsx:8-34](src/lib/withRoleGuard.tsx)
- Backend: DRF `IsAuthenticated` permission class + custom JWT auth in settings

---

## API Design Conventions

### URL Structure
Pattern: `/api/{app}/{action}/` with trailing slash

Examples from URL configs:
- Accounts: `/api/accounts/login/`, `/api/accounts/register/`, `/api/accounts/profile/`
- Restaurants: `/api/restaurants/`, `/api/restaurants/create/`, `/api/restaurants/{id}/`
- Orders: `/api/orders/create/`, `/api/orders/list/`, `/api/orders/{id}/`
- Status transitions: `/api/orders/{id}/preparing/`, `/api/orders/{id}/ready/`

### Response Pattern
- DRF `Response()` with explicit status codes
- Error responses include message field
- Frontend throws on non-OK HTTP status: [src/lib/queryClient.ts:3-8](src/lib/queryClient.ts)

### Mutation Pattern (Frontend)
```
useMutation → apiRequest (with JWT) → onSuccess: invalidateQueries + toast → onError: toast
```
Reference: [src/components/Cart.tsx:77-129](src/components/Cart.tsx)

---

## Django Model Conventions

- **UUID primary keys** on all models: [ZimFeast/accounts/models.py:25](ZimFeast/accounts/models.py)
- **Custom User model** with role field (customer, restaurant, driver, admin): [ZimFeast/accounts/models.py:17-40](ZimFeast/accounts/models.py)
- **Order status workflow**: pending -> confirmed -> preparing -> ready -> picked_up -> delivered
- Standard Django ORM (no raw SQL)
- SQLite for development, PostgreSQL-ready

---

## Component Organization

### File Naming
- Components: **PascalCase** (`Cart.tsx`, `MenuDialog.tsx`, `Navbar.tsx`)
- Hooks: **camelCase** with `use` prefix (`useAuth.ts`, `useOrderSocket.ts`)
- Utils: **camelCase** (`queryClient.ts`, `driverLocationTracker.ts`)
- Directories: **kebab-case** (`customer-components/`, `driver-components/`)
- Django files: **snake_case** (`models.py`, `views.py`, `serializers.py`)

### Page Organization by Role
Pages are grouped by user role in subdirectories:
- `src/pages/admin-components/` - Admin dashboard views
- `src/pages/business-components/` - Restaurant owner views
- `src/pages/customer-components/` - Customer-facing views
- `src/pages/driver-components/` - Driver app views
- `src/pages/checkout-components/` - Checkout flow
- `src/pages/home-components/` - Landing/public pages
- `src/pages/restaurant-components/` - Restaurant detail views

---

## Real-Time Communication Pattern

### Service Layer (Node.js)
- Constructor injection for dependencies: [real-time-server/src/index.js:56-57](real-time-server/src/index.js)
  - `DriverService(redisClient)` - manages driver state in Redis
  - `OrderService(redisClient, driverService)` - order lifecycle + driver matching
- Socket.IO namespaces separate concerns: `/drivers` and `/customers`

### Redis Pub/Sub Bridge
- Django publishes order events to Redis: `ZimFeast/realtime/` app
- Node.js subscribes and broadcasts to connected WebSocket clients
- Enables decoupled real-time updates without Django handling WebSocket connections directly

---

## Error Handling

### Frontend
- `apiRequest()` throws on non-200: [src/lib/queryClient.ts:3-8](src/lib/queryClient.ts)
- Toast notifications for user-facing errors via `useToast` hook
- React Query `onError` callbacks on mutations

### Backend
- DRF `Response()` with HTTP status codes
- Try/except in views with appropriate error responses
- Logger setup per app: [ZimFeast/orders/views.py:12-14](ZimFeast/orders/views.py)

### Real-Time Server
- Try/catch around async Redis and HTTP operations
- Graceful degradation when Redis unavailable

---

## Shared Utilities

Duplicated utility functions exist in both frontend and shared directories:
- Haversine distance calculation: [shared/deliveryUtils.ts](shared/deliveryUtils.ts)
- Driver assignment algorithm: [shared/driverAssignment.ts](shared/driverAssignment.ts)

---

## UI Stack

- **Radix UI** primitives for accessible headless components
- **shadcn/ui** wrapper components in `src/components/ui/`
- **Tailwind CSS** for all styling (dark mode support via class strategy)
- **Framer Motion** for animations
- **Lucide React** for icons
- **Recharts** for dashboard charts
- Config: [components.json](components.json) (shadcn config), [tailwind.config.ts](tailwind.config.ts)
