# ZimFeast - Complete Technical Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Frontend Documentation](#frontend-documentation)
6. [Backend Documentation](#backend-documentation)
7. [Realtime Server Documentation](#realtime-server-documentation)
8. [Database Schema](#database-schema)
9. [API Reference](#api-reference)
10. [Authentication Flow](#authentication-flow)
11. [Order Flow](#order-flow)
12. [Real-Time Communication](#real-time-communication)
13. [Environment Variables](#environment-variables)
14. [Deployment](#deployment)

---

## Project Overview

ZimFeast is a comprehensive food delivery platform designed for the Zimbabwean market. It connects three key stakeholders:
- **Customers**: Browse restaurants, place orders, track deliveries
- **Restaurants**: Manage menus, process orders, view analytics
- **Drivers**: Accept delivery offers, navigate to locations, complete deliveries

### Key Features
- Multi-role authentication system (customer, restaurant, driver, admin)
- Real-time order tracking with live driver location
- Google Maps integration for navigation and distance calculation
- Payment processing via Paynow (Zimbabwe) + Feast Voucher e-wallet
- Nearest-driver matching algorithm
- WebSocket-based live updates
- Nearby restaurant search with geolocation
- Restaurant external API integrations for menus/categories

---

## Architecture

ZimFeast uses a **microservices architecture** with 5 Django services, 1 Node.js real-time service, an Nginx API gateway, and a React SPA frontend:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────┬─────────────────────────────────────┬─────────────────────┤
│   Web Browser   │        Android Customer App         │  Android Driver App │
│   (React SPA)   │           (Kotlin/Java)             │    (Kotlin/Java)    │
└────────┬────────┴──────────────┬──────────────────────┴──────────┬──────────┘
         │                       │                                  │
         │ HTTP/HTTPS            │ HTTP + Socket.IO                 │ Socket.IO
         │                       │                                  │
┌────────▼──────────────────────▼──────────────────────────────────▼──────────┐
│                         API GATEWAY (Nginx :80)                              │
│   /api/accounts/  → auth-service:8001                                        │
│   /api/restaurants/ → restaurant-service:8002                                │
│   /api/orders/    → order-service:8003                                       │
│   /api/drivers/   → driver-service:8004                                      │
│   /api/payments/  → payment-service:8005                                     │
│   /socket.io/     → realtime-service:3001                                    │
│   /ws/restaurant/ → restaurant-service (WebSocket)                           │
│   /ws/driver/     → driver-service (WebSocket)                               │
│   /*              → React SPA (static files)                                 │
└────────┬──────────────────────────────────────────────────────────┬─────────┘
         │                                                          │
┌────────▼──────────────────────────────────────────────────────────▼─────────┐
│                          MICROSERVICES LAYER                                 │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────────────┤
│ auth     │restaurant│ order    │ driver   │ payment  │  realtime           │
│ :8001    │ :8002    │ :8003    │ :8004    │ :8005    │  :3001              │
│ Django   │ Django   │ Django   │ Django   │ Django   │  Node.js+Socket.IO  │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴──────────┬──────────┘
     │          │          │          │          │                │
     │   Each service has its own PostgreSQL DB                  │
     │                                                           │
┌────▼───────────────────────────────────────────────────────────▼────────────┐
│                            DATA LAYER                                       │
├─────────────────────────────┬──────────────────────────────────────────────┤
│       PostgreSQL            │              Redis 7                          │
│  (1 database per service)   │       Cache + Pub/Sub Broker                 │
└─────────────────────────────┴──────────────────────────────────────────────┘
```

### Communication Patterns

1. **Client → API Gateway → Service**: All HTTP requests go through Nginx reverse proxy
2. **Client → Realtime**: Socket.IO for live order tracking and driver location
3. **Service → Service (sync)**: REST calls via `shared/service_client.py` with `X-Service-Key` header
4. **Service → Service (async)**: Redis Pub/Sub via `shared/redis_publisher.py`
5. **Auth**: Stateless JWT - each service validates tokens independently using `shared/jwt_auth.py`
6. **Data refs**: Services reference entities in other services by UUID (no cross-service foreign keys)

---

## Technology Stack

### Frontend (React)
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3 | UI library |
| TypeScript | 5.6 | Type safety |
| Vite | 5.4 | Build tool & dev server |
| TanStack Query | 5.60 | Server state management |
| Wouter | - | Client-side routing |
| Tailwind CSS | 3.4 | Utility-first styling |
| Radix UI / shadcn | Various | Accessible UI components |
| Socket.IO Client | 4.8 | WebSocket communication |
| Google Maps React | 1.2 | Maps integration |

### Backend (Django Microservices)
| Technology | Version | Purpose |
|------------|---------|---------|
| Django | 4.2 | Web framework |
| Django REST Framework | 3.16 | REST API |
| Django Channels | 4.3 | WebSocket support |
| Daphne | 4.2 | ASGI server |
| Gunicorn | - | WSGI server |
| channels_redis | 4.3 | Redis channel layer |
| PyJWT | 2.10 | JWT authentication |
| googlemaps | 4.10 | Google Maps API |
| geopy | - | Geolocation distance calculations |
| paynow | 1.0 | Payment gateway |
| Pillow | 12.0 | Image processing |

### Realtime Server (Node.js)
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 4.18 | HTTP server |
| Socket.IO | 4.7 | WebSocket server |
| Redis | 4.6 | Pub/Sub & caching |
| Axios | 1.6 | HTTP client |
| dotenv | 17.2 | Environment config |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker + Docker Compose | Container orchestration |
| Nginx | API gateway / reverse proxy |
| PostgreSQL | Database (1 per service) |
| Redis 7 | Cache + Pub/Sub message broker |

---

## Project Structure

```
ZimFeast/
├── services/                        # MICROSERVICES (Docker)
│   ├── shared/                      #   Shared utilities across all services
│   │   ├── jwt_auth.py              #   Stateless JWT authentication
│   │   ├── redis_publisher.py       #   Redis Pub/Sub publisher
│   │   ├── service_client.py        #   Inter-service REST client
│   │   ├── geo_utils.py             #   Geolocation helpers
│   │   └── base_settings.py         #   Shared Django settings
│   │
│   ├── auth-service/                #   Port 8001 - Authentication
│   │   └── accounts/
│   │       ├── models.py            #   CustomUser, Address, BlacklistedToken
│   │       ├── views.py             #   Auth endpoints
│   │       └── urls.py              #   Account routes
│   │
│   ├── restaurant-service/          #   Port 8002 - Restaurant management
│   │   └── restaurants/
│   │       ├── models.py            #   Restaurant, MenuItem, CategoryType, CuisineType, RestaurantDashboard
│   │       ├── serializers.py       #   Serializers (read + write)
│   │       ├── views.py             #   Restaurant/menu/dashboard endpoints
│   │       └── urls.py              #   Restaurant routes
│   │
│   ├── order-service/               #   Port 8003 - Order lifecycle
│   │   └── orders/
│   │       ├── models.py            #   Order, OrderItem
│   │       ├── views.py             #   Order endpoints
│   │       └── urls.py              #   Order routes
│   │
│   ├── driver-service/              #   Port 8004 - Driver management
│   │   └── drivers/
│   │       ├── models.py            #   Driver, DriverOrderStatus, DriverFinance, DriverRating, DriverReject
│   │       ├── views.py             #   Driver endpoints
│   │       └── urls.py              #   Driver routes
│   │
│   ├── payment-service/             #   Port 8005 - Payment processing
│   │   └── payments/
│   │       ├── models.py            #   Payment, FeastVoucher
│   │       ├── paynow_utils.py      #   Paynow integration
│   │       ├── views.py             #   Payment endpoints
│   │       └── urls.py              #   Payment routes
│   │
│   ├── realtime-service/            #   Port 3001 - Socket.IO Dockerfile
│   ├── api-gateway/                 #   Port 80 - Nginx config
│   │   └── nginx.conf               #   Reverse proxy routing rules
│   ├── frontend/                    #   Frontend build Dockerfile
│   └── init-db.sql                  #   Creates per-service PostgreSQL databases
│
├── src/                             # FRONTEND (React SPA)
│   ├── components/                  #   Reusable UI components
│   │   ├── ui/                      #   Base shadcn/Radix UI components
│   │   ├── Cart.tsx                 #   Shopping cart
│   │   ├── DriverLocationMap.tsx    #   Live driver tracking map
│   │   ├── MenuDialog.tsx           #   Restaurant menu modal
│   │   ├── Navbar.tsx               #   Navigation bar
│   │   ├── OrderTracking.tsx        #   Order status tracker
│   │   └── RestaurantCard.tsx       #   Restaurant display card
│   ├── hooks/                       #   Custom React hooks
│   │   ├── useAuth.ts               #   Authentication hook
│   │   ├── useOrderSocket.ts        #   Socket.IO order tracking
│   │   ├── useWebSocket.ts          #   Generic WebSocket hook
│   │   └── use-toast.ts             #   Toast notifications
│   ├── lib/                         #   Utility functions
│   │   ├── authUtils.ts             #   Auth helper functions
│   │   ├── queryClient.ts           #   TanStack Query config
│   │   ├── utils.ts                 #   General utilities (cn, etc.)
│   │   └── withRoleGuard.tsx        #   Role-based route protection
│   ├── pages/                       #   Page components
│   │   ├── admin-components/        #   Admin dashboard components
│   │   ├── business-components/     #   Business registration
│   │   ├── checkout-components/     #   Checkout flow (CheckoutForm, MobilePaymentFields)
│   │   ├── customer-components/     #   Customer app components
│   │   ├── driver-components/       #   Driver app components
│   │   ├── home-components/         #   Home page components
│   │   ├── restaurant-components/   #   Restaurant dashboard
│   │   └── *.tsx                    #   Top-level page components
│   ├── App.tsx                      #   Root component with routing
│   ├── main.tsx                     #   Application entry point
│   └── index.css                    #   Global styles
│
├── real-time-server/                # REALTIME SERVER (Node.js)
│   └── src/
│       ├── services/
│       │   ├── DriverService.js     #   Driver management class
│       │   └── OrderService.js      #   Order & delivery class
│       ├── sockets/
│       │   ├── drivers.js           #   Driver socket handlers
│       │   └── customers.js         #   Customer socket handlers
│       └── index.js                 #   Server entry point
│
├── shared/                          # Shared TypeScript utilities
│   └── deliveryUtils.ts             #   Delivery rate constants
│
├── driver-app/                      # Android driver app (Kotlin/Java)
├── zimfeast-customer/               # Android customer app (Kotlin/Java)
│
├── docker-compose.yml               # Full stack orchestration
├── .env                             # All environment variables
├── scripts/                         # Docker start/scale scripts
├── CLAUDE.md                        # AI assistant instructions
├── DOCUMENTATION.md                 # This file
└── LOCAL_SETUP.md                   # Local development guide
```

---

## Frontend Documentation

### Component Architecture

The frontend follows a modular component architecture:

```
App.tsx (Router)
├── Landing.tsx (Public)
├── Home.tsx (Portal Selection)
├── Login.tsx / RegisterPage.tsx (Auth)
├── CustomerApp.tsx (Customer Portal)
│   ├── Header.tsx
│   ├── QuickFilters.tsx
│   ├── TopRestaurants.tsx
│   ├── AllRestaurants.tsx
│   └── CartComponent.tsx
├── Checkout.tsx (Checkout Flow)
│   ├── CheckoutForm.tsx
│   └── MobilePaymentFields.tsx
├── RestaurantDashboard.tsx (Restaurant Portal)
│   ├── DashboardLayout.tsx
│   ├── DashboardHeader.tsx
│   ├── StatsCards.tsx
│   ├── LiveOrders.tsx
│   └── MenuManagement.tsx
├── DriverApp.tsx (Driver Portal)
│   ├── Header.tsx
│   ├── StatsSection.tsx
│   ├── ActiveDeliveries.tsx
│   └── DeliveryHistory.tsx
└── AdminDashboard.tsx (Admin Portal)
    ├── RestaurantCard.tsx
    └── DriverCard.tsx
```

### Custom Hooks

#### `useAuth.ts`
Manages authentication state and user profile.

```typescript
interface UseAuthReturn {
  user: User | undefined;        // Current user data
  isAuthenticated: boolean;      // Login status
  isLoading: boolean;            // Loading state
  error: Error | null;           // Auth errors
  refetch: () => void;           // Manual refetch
}

function useAuth(): UseAuthReturn
```

#### `useOrderSocket.ts`
Manages real-time order tracking via Socket.IO.

```typescript
interface UseOrderSocketReturn {
  status: string | null;              // Current order status
  driverLocation: DriverLocation | null; // Live driver coords
  eta: ETA | null;                    // Estimated arrival
  connected: boolean;                 // Socket connection status
}

function useOrderSocket(
  orderId: string | null,
  orderMethod?: 'delivery' | 'collection'
): UseOrderSocketReturn
```

#### `apiRequest<T>()`
Generic API request function with JWT authentication.

```typescript
async function apiRequest<T>(
  url: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  data?: any
): Promise<T>
```

### Key Components

#### `OrderTracking.tsx`
Displays real-time order status with progress indicator.

**Features:**
- Status progress bar (pending -> preparing -> ready -> delivered/collected)
- Driver information display (for delivery orders)
- ETA countdown
- "Track Driver" button integration

#### `DriverLocationMap.tsx`
Google Maps integration for live driver tracking.

**Features:**
- Real-time driver marker updates
- Route polyline display
- ETA calculation using Google Directions API
- Restaurant and delivery location markers

#### `CheckoutForm.tsx`
Handles payment flow with multiple payment methods.

**Payment Methods:**
- **PayNow Web**: Opens Paynow payment page in new tab
- **PayNow Mobile**: Sends STK push to phone number (EcoCash, OneMoney), polls for status
- **Feast Voucher**: Uses e-wallet balance, supports partial payment with PayNow fallback

**Features:**
- Order summary with item breakdown, delivery fee, tip
- Voucher balance display and top-up via PayNow
- Mobile payment status polling (5s intervals, 2min timeout)
- Delivery fee rate display (per km)

### State Management

The application uses **TanStack Query** for server state:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});
```

**Query Key Patterns:**
- `/api/accounts/profile/` - User profile
- `/api/restaurants/get/all/` - Restaurant list
- `/api/restaurants/{id}/menu/` - Restaurant menu
- `/api/orders/list/` - User orders
- `/api/orders/order/{id}/` - Order details

---

## Backend Documentation

### Microservices Overview

| Service | Port | Owns | Communicates via |
|---------|------|------|-----------------|
| auth-service | 8001 | Users, Addresses, BlacklistedTokens | JWT tokens (stateless) |
| restaurant-service | 8002 | Restaurants, MenuItems, Categories, Cuisines, Dashboards, ExternalAPIs | Redis pub/sub, WebSocket |
| order-service | 8003 | Orders, OrderItems | Redis pub/sub, REST |
| driver-service | 8004 | Drivers, DriverOrderStatus, DriverFinance, DriverRating, DriverReject | Redis pub/sub, WebSocket |
| payment-service | 8005 | Payments, FeastVouchers | REST to order-service |
| realtime-service | 3001 | None (stateless) | Redis sub, Socket.IO |
| api-gateway | 80 | None | Reverse proxy |

### Shared Utilities (`services/shared/`)

All services share common utilities:

- **`jwt_auth.py`**: Stateless JWT authentication class for DRF
- **`redis_publisher.py`**: Redis Pub/Sub publisher for inter-service events
- **`service_client.py`**: REST client for inter-service calls with `X-Service-Key` header
- **`geo_utils.py`**: Haversine distance calculation and delivery fee computation
- **`base_settings.py`**: Common Django settings (middleware, REST framework config, Redis cache, Paynow settings)

### auth-service (Port 8001)

**Models:**
```python
class CustomUser(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = ("customer", "restaurant", "driver", "admin")
    id: UUID (PK)
    email: str (unique, USERNAME_FIELD)
    first_name: str
    last_name: str
    phone_number: str
    role: str
    is_active: bool
    is_staff: bool

class Address(Model):
    user: FK(CustomUser)
    label: str              # "home", "work", etc.
    address_text: str
    lat: float
    lng: float

class BlacklistedToken(Model):
    token: str (unique)
    blacklisted_at: datetime
```

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/accounts/register/` | User registration |
| POST | `/api/accounts/login/` | User login (returns JWT) |
| POST | `/api/accounts/logout/` | Logout (blacklist token) |
| GET | `/api/accounts/profile/` | Get current user profile |
| GET | `/api/accounts/internal/user/{id}/` | Internal: get user by ID |

### restaurant-service (Port 8002)

**Models:**
```python
class CuisineType(Model):
    name: str (unique)

class CategoryType(Model):
    name: str (unique)

class Restaurant(Model):
    id: UUID (PK)
    owner_id: UUID          # References user in auth-service
    name: str
    phone_number: str
    description: str
    profile_image: ImageField
    full_address: str
    lat: float
    lng: float
    minimum_order_price: Decimal
    est_delivery_time: str
    cuisines: M2M(CuisineType)

class RestaurantExternalAPI(Model):
    restaurant: FK(Restaurant)
    category: str           # "meal_data", "categories", etc.
    api_url: URLField
    api_key: str

class MenuItem(Model):
    id: UUID (PK)
    restaurant: FK(Restaurant)
    name: str
    price: Decimal
    description: str
    category: M2M(CategoryType)
    prep_time: int          # Minutes
    available: bool
    item_image: ImageField

class RestaurantDashboard(Model):
    restaurant: OneToOne(Restaurant)
    today_orders: int
    today_revenue: Decimal
    today_average_rating: float
    preparing: JSONField    # List of order dicts
    pending: JSONField      # List of order dicts
    completed: JSONField    # List of order dicts
```

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/restaurants/create/` | Create restaurant |
| GET | `/api/restaurants/my-restaurant/` | Get owner's restaurant |
| PUT/PATCH | `/api/restaurants/{id}/` | Update restaurant |
| GET | `/api/restaurants/{id}/detail/` | Restaurant details (cached 5min) |
| GET | `/api/restaurants/get/all/` | List all restaurants (cached 2min) |
| GET | `/api/restaurants/search/` | Search restaurants |
| GET | `/api/restaurants/nearby/` | Nearby restaurants (lat, lng, radius_km) |
| POST | `/api/restaurants/add/menu-items/` | Add menu item (multipart) |
| PUT/PATCH | `/api/restaurants/menu/{id}/update/` | Update menu item (multipart) |
| DELETE | `/api/restaurants/menu/{id}/delete/` | Delete menu item |
| GET | `/api/restaurants/menu/` | Get owner's menu items |
| GET | `/api/restaurants/{id}/menu/` | Get restaurant menu (cached 5min) |
| GET | `/api/restaurants/{id}/menu-data/` | Alias for menu data |
| GET | `/api/restaurants/{id}/categories/` | Get categories (with external API fallback) |
| POST | `/api/restaurants/{id}/external-apis/` | Add external API |
| POST | `/api/restaurants/create/cuisine/` | Create cuisine type |
| GET | `/api/restaurants/get/cuisine/types/` | List cuisine types |
| POST | `/api/restaurants/create/category/` | Create category type |
| GET | `/api/restaurants/get/category/types/` | List category types |
| POST | `/api/restaurants/orders/{id}/preparing/` | Mark order preparing |
| POST | `/api/restaurants/orders/{id}/ready/` | Mark order ready |
| POST | `/api/restaurants/orders/{id}/collected/` | Mark order collected |
| GET | `/api/restaurants/internal/restaurant/{id}/` | Internal: get restaurant |

### order-service (Port 8003)

**Models:**
```python
class Order(Model):
    STATUS_CHOICES = (
        'pending_payment', 'paid', 'preparing', 'ready',
        'collected', 'assigned', 'out_for_delivery',
        'delivered', 'cancelled'
    )
    METHOD_CHOICES = ('delivery', 'collection')

    id: UUID (PK)
    customer_id: UUID       # References user in auth-service
    driver_id: UUID         # References user in auth-service
    restaurant_id: UUID     # References restaurant in restaurant-service
    status: str
    method: str
    restaurant_names: str
    total_fee: Decimal
    tip: Decimal
    each_item_price: JSONField
    delivery_fee: Decimal
    delivery_out_time: datetime
    delivery_complete_time: datetime
    external_order_numbers: JSONField
    # Location data (denormalized)
    restaurant_lat/lng: float
    delivery_lat/lng: float
    delivery_address: str
    # Driver info (denormalized)
    driver_name: str
    driver_phone: str
    driver_vehicle: str

class OrderItem(Model):
    user_id: UUID
    order: FK(Order)
    menu_item_id: UUID
    menu_item_name: str
    menu_item_price: Decimal
    quantity: int
```

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders/create/` | Create order |
| GET | `/api/orders/list/` | List user orders (paginated) |
| GET | `/api/orders/all/orders/` | List all orders (admin) |
| GET | `/api/orders/order/{id}/` | Get order details |
| POST | `/api/orders/order/{id}/assign-driver/` | Assign driver |
| PATCH | `/api/orders/order/{id}/status/` | Update order status |
| POST | `/api/orders/cancel/{id}/` | Cancel order |

### driver-service (Port 8004)

**Models:**
```python
class Driver(Model):
    id: UUID (PK)
    user_id: UUID (unique)  # References user in auth-service
    license_number: str
    license_photo: ImageField
    vehicle_details: JSONField
    vehicle_photo: ImageField
    is_online: bool
    lat: float
    lng: float

class DriverOrderStatus(Model):
    driver: FK(Driver)
    order_id: UUID
    status: str             # pending, accepted, delivering, completed, cancelled
    assigned_at: datetime
    completed_at: datetime

class DriverFinance(Model):
    driver: FK(Driver)
    date: date
    today_deliveries: int
    today_earnings: Decimal
    rating_sum: Decimal
    rating_count: int
    hours_online: Decimal

class DriverRating(Model):
    driver: FK(Driver)
    user_id: UUID
    rating: Decimal
    comment: str

class DriverReject(Model):
    driver: FK(Driver)
    order_id: str
    reason: str
```

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/drivers/profile/create/` | Create driver profile |
| POST | `/api/drivers/status/toggle/` | Toggle online/offline |
| GET | `/api/drivers/status/` | Get driver status |
| POST | `/api/drivers/location/update/` | Update GPS location |
| GET | `/api/drivers/active/orders/` | Get active orders |
| GET | `/api/drivers/orders/history/` | Get completed/cancelled orders |
| GET | `/api/drivers/daily/finances/` | Get daily finance summary |
| POST | `/api/drivers/order/{id}/reject/` | Reject order |
| POST | `/api/drivers/order/{id}/cancel/` | Cancel order |
| POST | `/api/drivers/rate/driver/` | Submit driver rating |

### payment-service (Port 8005)

**Models:**
```python
class FeastVoucher(Model):
    """User's e-wallet balance."""
    user_id: UUID
    balance: Decimal

class Payment(Model):
    PAYMENT_METHODS = ("paynow", "voucher")
    STATUS_CHOICES = ("pending", "paid", "failed")

    user_id: UUID
    order_id: UUID
    reference: str (unique)
    amount: Decimal
    method: str
    status: str
```

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/create/payment/` | Create payment (PayNow web/mobile or voucher) |
| POST | `/api/payments/result/` | PayNow result callback (public) |
| POST | `/api/payments/callback/` | PayNow callback (public) |
| POST | `/api/payments/deposit/` | Deposit to Feast Voucher via PayNow |
| GET | `/api/payments/status/{reference}/` | Check PayNow transaction status |
| GET | `/api/payments/feast/voucher/balance/` | Get voucher balance |

**Payment Flow:**
1. **Voucher**: Deducts from FeastVoucher balance. If insufficient, remainder goes through PayNow.
2. **PayNow Web**: Creates Paynow payment, returns redirect URL for browser.
3. **PayNow Mobile**: Sends STK push to phone number. Frontend polls `/status/{reference}/` every 5s.

---

## Realtime Server Documentation

### Service Classes

#### `DriverService.js`
Manages driver state and location tracking.

```javascript
class DriverService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.drivers = new Map();      // In-memory driver cache
    this.driverSockets = new Map(); // Socket ID to driver mapping
  }

  async registerDriver(driverId, socketId, driverData)
  async updateLocation(driverId, lat, lng)
  async setDriverStatus(driverId, status, orderId)
  async removeDriver(socketId)
  async findNearestAvailableDrivers(lat, lng, excludeDriverIds, limit)
  calculateDistance(lat1, lng1, lat2, lng2) // Haversine formula
}
```

#### `OrderService.js`
Manages delivery orders and driver matching.

```javascript
class OrderService {
  constructor(redisClient, driverService) {
    this.redis = redisClient;
    this.driverService = driverService;
    this.activeOrders = new Map();
    this.pendingOffers = new Map();
    this.orderRejections = new Map();
  }

  static async handleNewDeliveryOrder(io, redisClient, orderData)
  async findAndOfferToDriver(io, order, excludeDriverIds)
  async handleDriverAccept(io, driverId, orderId, driverData)
  async handleDriverReject(io, driverId, orderId)
  async updateOrderStatus(io, orderId, status, driverLocation)
  async calculateETA(orderId)
}
```

### Socket.IO Namespaces

#### `/drivers` - Driver Socket Events

**Incoming Events:**
| Event | Data | Description |
|-------|------|-------------|
| `driver:online` | `{driverId, name, phone, vehicle, lat, lng}` | Driver comes online |
| `driver:location` | `{lat, lng}` | GPS location update |
| `driver:status` | `{status}` | Availability change |
| `delivery:accept` | `{orderId}` | Accept delivery offer |
| `delivery:reject` | `{orderId}` | Reject delivery offer |
| `delivery:status` | `{orderId, status}` | Delivery status update |

**Outgoing Events:**
| Event | Data | Description |
|-------|------|-------------|
| `delivery:offer` | `{orderId, restaurant, customer, distances, price}` | New delivery offer |
| `delivery:accepted` | `{orderId, success}` | Offer acceptance result |
| `delivery:cancelled` | `{orderId, reason}` | Order cancelled |

#### `/customers` - Customer Socket Events

**Incoming Events:**
| Event | Data | Description |
|-------|------|-------------|
| `customer:join` | `{orderId, customerId}` | Join order room |
| `order:subscribe` | `{orderId, customerId}` | Subscribe to updates |
| `order:unsubscribe` | `{orderId}` | Unsubscribe |
| `order:get_eta` | `{orderId}` | Request ETA |
| `driver:rate` | `{orderId, driverId, rating, comment}` | Rate driver |

**Outgoing Events:**
| Event | Data | Description |
|-------|------|-------------|
| `order:status` | `{orderId, status, driverLocation}` | Status update |
| `order:driver_assigned` | `{orderId, driver}` | Driver assigned |
| `order:driver_location` | `{orderId, lat, lng}` | Live location |
| `order:eta` | `{orderId, eta, distance}` | ETA update |
| `order:no_drivers` | `{orderId, message}` | No drivers available |
| `order:completed` | `{orderId, requestRating}` | Delivery complete |

---

## Database Schema

Each microservice owns its own PostgreSQL database. Services reference entities in other services by UUID (no cross-database foreign keys).

### auth_db

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CustomUser    │────<│     Address      │     │ BlacklistedToken│
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (UUID) PK    │     │ id (int) PK     │     │ id (int) PK     │
│ email (unique)  │     │ user_id FK      │     │ token (unique)  │
│ first_name      │     │ label           │     │ blacklisted_at  │
│ last_name       │     │ address_text    │     └─────────────────┘
│ phone_number    │     │ lat, lng        │
│ role            │     └─────────────────┘
│ password        │
│ is_active       │
│ is_staff        │
└─────────────────┘
```

### restaurant_db

```
┌──────────────┐     ┌───────────────────┐     ┌────────────────┐
│ CuisineType  │     │   Restaurant      │     │ CategoryType   │
├──────────────┤     ├───────────────────┤     ├────────────────┤
│ id (int) PK  │<──M2M│ id (UUID) PK     │M2M──>│ id (int) PK    │
│ name (unique)│     │ owner_id (UUID)   │     │ name (unique)  │
└──────────────┘     │ name              │     └───────┬────────┘
                     │ full_address      │             │ M2M
                     │ lat, lng          │     ┌───────▼────────┐
                     │ minimum_order_price│    │   MenuItem     │
                     │ est_delivery_time │     ├────────────────┤
                     │ profile_image     │     │ id (UUID) PK   │
                     └───────┬───────────┘     │ restaurant FK  │
                             │                 │ name           │
                     ┌───────▼───────────┐     │ price          │
                     │ RestaurantDashboard│    │ prep_time      │
                     ├───────────────────┤     │ available      │
                     │ today_orders      │     │ item_image     │
                     │ today_revenue     │     └────────────────┘
                     │ pending (JSON)    │
                     │ preparing (JSON)  │     ┌─────────────────┐
                     │ completed (JSON)  │     │RestaurantExtAPI │
                     └───────────────────┘     ├─────────────────┤
                                               │ restaurant FK   │
                                               │ category        │
                                               │ api_url         │
                                               │ api_key         │
                                               └─────────────────┘
```

### order_db

```
┌──────────────────┐
│     Order        │
├──────────────────┤
│ id (UUID) PK     │     ┌───────────────┐
│ customer_id(UUID)│     │  OrderItem    │
│ restaurant_id    │────<├───────────────┤
│ driver_id (UUID) │     │ id (int) PK   │
│ status           │     │ order FK      │
│ method           │     │ user_id(UUID) │
│ total_fee        │     │ menu_item_id  │
│ tip              │     │ menu_item_name│
│ delivery_fee     │     │ menu_item_price│
│ each_item_price  │     │ quantity      │
│ restaurant_names │     └───────────────┘
│ delivery_address │
│ delivery_lat/lng │
│ restaurant_lat/lng│
│ driver_name/phone│
│ driver_vehicle   │
└──────────────────┘
```

### driver_db

```
┌─────────────────┐
│     Driver      │
├─────────────────┤
│ id (UUID) PK    │────<┬──────────────────┐
│ user_id (UUID)  │     │DriverOrderStatus │
│ license_number  │     ├──────────────────┤
│ license_photo   │     │ order_id (UUID)  │
│ vehicle_details │     │ status           │
│ vehicle_photo   │     │ assigned_at      │
│ is_online       │     │ completed_at     │
│ lat, lng        │     └──────────────────┘
└────────┬────────┘
         │
    ┌────┴────┬───────────────┬───────────────┐
    ▼         ▼               ▼               ▼
┌────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐
│Driver  │ │DriverFinance│ │DriverRating│ │DriverReject│
│Reject  │ ├────────────┤ ├────────────┤ └──────────┘
├────────┤ │ date        │ │ user_id    │
│order_id│ │ today_*     │ │ rating     │
│reason  │ │ rating_*    │ │ comment    │
└────────┘ │ hours_online│ └────────────┘
           └────────────┘
```

### payment_db

```
┌──────────────────┐     ┌──────────────────┐
│    Payment       │     │  FeastVoucher    │
├──────────────────┤     ├──────────────────┤
│ user_id (UUID)   │     │ user_id (UUID)   │
│ order_id (UUID)  │     │ balance          │
│ reference(unique)│     └──────────────────┘
│ amount           │
│ method           │
│ status           │
└──────────────────┘
```

---

## API Reference

### Authentication Headers

All protected endpoints require JWT authentication:

```
Authorization: Bearer <jwt_token>
```

### Inter-Service Authentication

Service-to-service calls use:

```
X-Service-Key: <shared_service_key>
```

### Common HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (delete) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

## Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │     │  API Gateway │     │ auth-service  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ POST /api/accounts/register/            │
       │───────────────────>│───────────────────>│
       │                    │                    │  Create User
       │                    │  { user, token }   │
       │<───────────────────│<───────────────────│
       │                    │                    │
       │  Store token in    │                    │
       │  localStorage      │                    │
       │                    │                    │
       │ GET /api/accounts/profile/              │
       │ + Authorization: Bearer <token>         │
       │───────────────────>│───────────────────>│
       │                    │                    │  Validate JWT
       │  { user }          │                    │  (shared secret)
       │<───────────────────│<───────────────────│
       │                    │                    │
       │  Any service call  │   ┌──────────────┐│
       │ + Bearer <token>   │   │ other service ││
       │───────────────────>│──>│ validates JWT ││
       │                    │   │ independently ││
       │                    │   └──────────────┘│
```

Each microservice validates JWT tokens independently using the shared secret in `shared/jwt_auth.py`. No service needs to call auth-service to verify tokens.

---

## Order Flow

### Delivery Order Flow

```
1. CUSTOMER places order
   └─> POST /api/orders/create/
   └─> Status: pending_payment

2. CUSTOMER pays via Paynow or Voucher
   └─> POST /api/payments/create/payment/
   └─> payment-service calls order-service to update status
   └─> Status: paid

3. RESTAURANT sees new order on dashboard
   └─> WebSocket: restaurant dashboard updates via Redis

4. RESTAURANT clicks "Preparing"
   └─> POST /api/restaurants/orders/{id}/preparing/
   └─> Status: preparing
   └─> Redis publishes: orders.delivery.created
   └─> Realtime server starts driver matching

5. DRIVER receives offer via Socket.IO
   └─> Shows: restaurant, customer, distance, price
   └─> 30-second timeout

6. DRIVER accepts offer
   └─> Status: assigned
   └─> Customer notified of driver details
   └─> Driver sees navigation to restaurant

7. DRIVER picks up order
   └─> Status: out_for_delivery
   └─> Customer sees live driver location (5s updates)

8. DRIVER delivers order
   └─> Status: delivered
   └─> Customer prompted to rate driver
```

### Collection Order Flow

```
1. CUSTOMER places order (method: collection)
   └─> Status: pending_payment

2. CUSTOMER pays via Paynow or Voucher
   └─> Status: paid

3. RESTAURANT clicks "Preparing"
   └─> Status: preparing
   └─> No driver matching (collection)

4. RESTAURANT marks order "Ready"
   └─> Status: ready
   └─> Customer notified to pick up

5. CUSTOMER picks up order
   └─> Status: collected
```

---

## Real-Time Communication

### WebSocket Connection Flow

```
Frontend                    Realtime Server               Backend Services
   │                              │                          │
   │  Connect to /customers       │                          │
   │─────────────────────────────>│                          │
   │                              │                          │
   │  Emit: order:subscribe       │                          │
   │  { orderId, customerId }     │                          │
   │─────────────────────────────>│                          │
   │                              │  Join room: order:{id}   │
   │                              │                          │
   │                              │ [Redis] orders.status.changed
   │                              │<─────────────────────────│
   │  Emit: order:status          │                          │
   │  { status, driverLocation }  │                          │
   │<─────────────────────────────│                          │
   │                              │                          │
   │  Emit: order:driver_location │                          │
   │  { lat, lng } (every 5s)     │                          │
   │<─────────────────────────────│                          │
```

### Restaurant Dashboard WebSocket

Restaurant dashboards receive live updates through Django Channels:
- WebSocket path: `/ws/restaurant/`
- Proxied through Nginx to restaurant-service
- Updates sent when order status changes via `send_dashboard_update()`

### Driver WebSocket

Driver location tracking through Django Channels:
- WebSocket path: `/ws/driver/`
- Proxied through Nginx to driver-service

---

## Environment Variables

All variables are in the root `.env` file. Key sections:

### Database
```env
POSTGRES_USER=                # PostgreSQL user
POSTGRES_PASSWORD=            # PostgreSQL password
POSTGRES_HOST=                # Host (default: postgres in Docker)
POSTGRES_PORT=                # Port (default: 5432)
AUTH_DB_NAME=                 # auth-service database
RESTAURANT_DB_NAME=           # restaurant-service database
ORDER_DB_NAME=                # order-service database
DRIVER_DB_NAME=               # driver-service database
PAYMENT_DB_NAME=              # payment-service database
```

### Services
```env
SECRET_KEY=                   # Shared JWT secret key
SERVICE_API_KEY=              # Inter-service communication key
AUTH_SERVICE_URL=             # http://auth-service:8001
RESTAURANT_SERVICE_URL=       # http://restaurant-service:8002
ORDER_SERVICE_URL=            # http://order-service:8003
DRIVER_SERVICE_URL=           # http://driver-service:8004
PAYMENT_SERVICE_URL=          # http://payment-service:8005
```

### Third-Party APIs
```env
GOOGLE_API_KEY=               # Google Maps API key
OPENAI_API_KEY=               # OpenAI API key
SENDGRID_API_KEY=             # SendGrid for emails
```

### Paynow (Payment Gateway)
```env
PAYNOW_INTEGRATION_ID=       # Paynow merchant ID
PAYNOW_INTEGRATION_KEY=      # Paynow secret key
PAYNOW_RETURN_URL=            # Return URL after payment
PAYNOW_RESULT_URL=            # Server callback URL
PAYNOW_SANDBOX_URL=           # Sandbox URL for testing
```

### Redis
```env
REDIS_URL=                    # Redis connection URL (default: redis://localhost:6379)
```

### Frontend
```env
VITE_GOOGLE_MAPS_API_KEY=     # Google Maps JavaScript API key
VITE_API_URL=                 # Backend API URL
VITE_REALTIME_URL=            # Realtime server URL
```

---

## Deployment

### Docker Compose Architecture

The entire stack is orchestrated with Docker Compose:

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                       │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ auth-service │ │rest-service │ │order-service│           │
│  │   :8001      │ │   :8002     │ │   :8003     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │driver-svc   │ │payment-svc  │ │realtime-svc │           │
│  │   :8004     │ │   :8005     │ │   :3001     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                              │
│  ┌──────────────────────────────────────────────┐           │
│  │           API Gateway (Nginx :80)             │           │
│  │  Routes /api/* to services, serves SPA        │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
│  ┌─────────────┐              ┌─────────────┐               │
│  │ PostgreSQL  │              │    Redis     │               │
│  │  (5 DBs)    │              │   :6379      │               │
│  └─────────────┘              └─────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### Commands

```bash
# Build and start everything
bash scripts/docker-start.sh

# Start all services
docker compose up -d

# Tail logs for a service
docker compose logs -f order-service

# Scale a service
bash scripts/docker-scale.sh order-service 5
# or: docker compose up --scale order-service=5

# Stop everything
docker compose down
```

### Local Development

```bash
# Frontend
npm run dev              # Vite dev server (port 5000)
npm run build            # Production build
npm run check            # TypeScript type check

# Individual services
cd services/auth-service && python manage.py runserver 8001
cd services/restaurant-service && python manage.py runserver 8002
cd services/order-service && python manage.py runserver 8003
cd services/driver-service && python manage.py runserver 8004
cd services/payment-service && python manage.py runserver 8005

# Real-time server
cd real-time-server && npm start    # Port 3001
```

---

## Troubleshooting Guide

### Common Issues

1. **"Redis connection refused"**
   - Ensure Redis is running: `redis-cli ping`
   - Check `REDIS_URL` environment variable

2. **"CORS errors"**
   - Verify `CORS_ALLOWED_ORIGINS` in `.env`
   - In debug mode, `CORS_ALLOW_ALL_ORIGINS` is enabled automatically

3. **"JWT token expired"**
   - Frontend should handle 401 and redirect to login
   - Token lifetime configurable in settings

4. **"Google Maps not loading"**
   - Verify API key is valid and billing is active
   - Check both `GOOGLE_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY`

5. **"Socket.IO connection failed"**
   - Verify realtime server is running on port 3001
   - Check Nginx WebSocket proxy config (`/socket.io/`)

6. **"Inter-service communication failing"**
   - Check `SERVICE_API_KEY` matches across all services
   - Verify service URLs in environment variables
   - Check Docker network connectivity

7. **"Database migration errors"**
   - Each service has its own database; run migrations per service
   - Ensure `init-db.sql` has created all required databases

---

## Contributing

### Code Style

- **Python**: Follow PEP 8, use type hints
- **JavaScript**: ES6+, use async/await
- **TypeScript**: Strict mode, proper interfaces
- **React**: Functional components, custom hooks
- **Django**: Function-based views with DRF decorators

### Git Workflow

1. Create feature branch from `main`
2. Make changes with clear commits
3. Test locally with Docker Compose
4. Submit pull request for review

---

## License

Proprietary - All rights reserved.

---

*Documentation last updated: March 2026*
