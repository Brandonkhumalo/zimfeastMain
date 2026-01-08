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
- Multi-role authentication system
- Real-time order tracking with live driver location
- Google Maps integration for navigation and distance calculation
- Payment processing via Paynow (Zimbabwe)
- Nearest-driver matching algorithm
- WebSocket-based live updates

---

## Architecture

ZimFeast uses a **three-tier microservices architecture**:

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
┌────────▼────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                     │
├─────────────────────────────┬───────────────────────────────────────────────┤
│       Frontend Server       │              Realtime Server                   │
│         (Port 5000)         │               (Port 3001)                      │
│    React/Vite Dev Server    │           Node.js + Socket.IO                  │
│                             │                                                │
│  - Serves React SPA         │  - Manages WebSocket connections               │
│  - Proxies API requests     │  - Driver matching algorithm                   │
│  - Hot module replacement   │  - Real-time location updates                  │
└─────────────────────────────┴────────────────────┬──────────────────────────┘
                                                   │
                              ┌────────────────────┴────────────────────┐
                              │          Redis (Pub/Sub)                │
                              │         Message Broker                  │
                              └────────────────────┬────────────────────┘
                                                   │
┌──────────────────────────────────────────────────▼──────────────────────────┐
│                            BACKEND SERVER                                    │
│                            (Port 8000)                                       │
│                     Django + Django REST Framework                           │
│                                                                              │
│  - REST API endpoints                                                        │
│  - Authentication (JWT)                                                      │
│  - Business logic                                                            │
│  - Database ORM                                                              │
│  - Payment processing                                                        │
└──────────────────────────────────────────────────┬──────────────────────────┘
                                                   │
┌──────────────────────────────────────────────────▼──────────────────────────┐
│                            DATA LAYER                                        │
├─────────────────────────────┬───────────────────────────────────────────────┤
│       SQLite/PostgreSQL     │              Redis Cache                       │
│       Primary Database      │          Session & Pub/Sub                     │
└─────────────────────────────┴───────────────────────────────────────────────┘
```

### Communication Flow

1. **Frontend → Backend**: HTTP REST API calls for CRUD operations
2. **Frontend → Realtime**: Socket.IO for live order tracking
3. **Backend → Realtime**: Redis Pub/Sub when order status changes
4. **Realtime → Backend**: HTTP API for driver assignments

---

## Technology Stack

### Frontend (React)
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3 | UI library |
| TypeScript | 5.6 | Type safety |
| Vite | 5.4 | Build tool & dev server |
| TanStack Query | 5.60 | Server state management |
| React Router DOM | 7.9 | Client-side routing |
| Tailwind CSS | 3.4 | Utility-first styling |
| Radix UI | Various | Accessible UI components |
| Socket.IO Client | 4.8 | WebSocket communication |
| Google Maps React | 1.2 | Maps integration |

### Backend (Django)
| Technology | Version | Purpose |
|------------|---------|---------|
| Django | 4.2 | Web framework |
| Django REST Framework | 3.16 | REST API |
| Django Channels | 4.3 | WebSocket support |
| Daphne | 4.2 | ASGI server |
| channels_redis | 4.3 | Redis channel layer |
| PyJWT | 2.10 | JWT authentication |
| googlemaps | 4.10 | Google Maps API |
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

---

## Project Structure

```
ZimFeast/
├── src/                          # FRONTEND (React)
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Base UI components (Radix-based)
│   │   ├── Cart.tsx              # Shopping cart component
│   │   ├── DriverLocationMap.tsx # Live driver tracking map
│   │   ├── MenuDialog.tsx        # Restaurant menu modal
│   │   ├── Navbar.tsx            # Navigation bar
│   │   ├── OrderTracking.tsx     # Order status tracker
│   │   └── RestaurantCard.tsx    # Restaurant display card
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts            # Authentication hook
│   │   ├── useOrderSocket.ts     # Socket.IO order tracking
│   │   ├── useWebSocket.ts       # Generic WebSocket hook
│   │   └── use-toast.ts          # Toast notifications
│   ├── lib/                      # Utility functions
│   │   ├── authUtils.ts          # Auth helper functions
│   │   ├── queryClient.ts        # TanStack Query config
│   │   ├── utils.ts              # General utilities (cn, etc.)
│   │   └── withRoleGuard.tsx     # Role-based route protection
│   ├── pages/                    # Page components
│   │   ├── admin-components/     # Admin dashboard components
│   │   ├── business-components/  # Business registration
│   │   ├── checkout-components/  # Checkout flow
│   │   ├── customer-components/  # Customer app components
│   │   ├── driver-components/    # Driver app components
│   │   ├── home-components/      # Home page components
│   │   ├── restaurant-components/# Restaurant dashboard
│   │   ├── AdminDashboard.tsx    # Admin main page
│   │   ├── BusinessHub.tsx       # Business registration page
│   │   ├── Checkout.tsx          # Checkout page
│   │   ├── CustomerApp.tsx       # Customer main page
│   │   ├── DriverApp.tsx         # Driver main page
│   │   ├── Home.tsx              # Portal selection page
│   │   ├── Landing.tsx           # Public landing page
│   │   ├── Login.tsx             # Login page
│   │   ├── PaymentReturn.tsx     # Payment callback page
│   │   ├── RegisterPage.tsx      # Registration page
│   │   └── RestaurantDashboard.tsx # Restaurant main page
│   ├── App.tsx                   # Root component with routing
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Global styles
│
├── ZimFeast/                     # BACKEND (Django)
│   ├── accounts/                 # User authentication app
│   │   ├── models.py             # CustomUser, Address, BlacklistedToken
│   │   ├── serializers.py        # User serialization
│   │   ├── token.py              # JWT token utilities
│   │   ├── views.py              # Auth endpoints
│   │   └── urls.py               # Account routes
│   ├── restaurants/              # Restaurant management app
│   │   ├── models.py             # Restaurant, MenuItem, CategoryType
│   │   ├── serializers.py        # Restaurant/menu serialization
│   │   ├── views.py              # Restaurant endpoints
│   │   ├── pagination.py         # Custom pagination
│   │   └── urls.py               # Restaurant routes
│   ├── orders/                   # Order processing app
│   │   ├── models.py             # Order, OrderItem
│   │   ├── serializers.py        # Order serialization
│   │   ├── views.py              # Order endpoints
│   │   ├── utils.py              # Order utilities
│   │   └── urls.py               # Order routes
│   ├── drivers/                  # Driver management app
│   │   ├── models.py             # Driver, DriverFinance, DriverRating
│   │   ├── serializer.py         # Driver serialization
│   │   ├── views.py              # Driver endpoints
│   │   ├── consumers.py          # WebSocket consumers
│   │   ├── utils.py              # Distance calculations
│   │   └── urls.py               # Driver routes
│   ├── payments/                 # Payment processing app
│   │   ├── models.py             # Payment, Transaction
│   │   ├── paynow_utils.py       # Paynow integration
│   │   ├── receipt_email.py      # Email receipts
│   │   ├── views.py              # Payment endpoints
│   │   └── urls.py               # Payment routes
│   ├── realtime/                 # Realtime utilities
│   │   └── redis_publisher.py    # Redis Pub/Sub publisher
│   ├── ZimFeast/                 # Django project settings
│   │   ├── settings.py           # Configuration
│   │   ├── urls.py               # Root URL config
│   │   ├── asgi.py               # ASGI application
│   │   └── wsgi.py               # WSGI application
│   ├── manage.py                 # Django CLI
│   └── requirements.txt          # Python dependencies
│
├── real-time-server/             # REALTIME SERVER (Node.js)
│   ├── src/
│   │   ├── services/
│   │   │   ├── DriverService.js  # Driver management class
│   │   │   └── OrderService.js   # Order & delivery class
│   │   ├── sockets/
│   │   │   ├── drivers.js        # Driver socket handlers
│   │   │   └── customers.js      # Customer socket handlers
│   │   └── index.js              # Server entry point
│   ├── package.json              # Node dependencies
│   └── .env                      # Environment variables
│
├── driver-app/                   # Android driver app (external)
├── customer-app/                 # Android customer app (external)
├── LOCAL_SETUP.md                # Local development guide
├── DOCUMENTATION.md              # This file
└── replit.md                     # Replit-specific docs
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

**Props:**
```typescript
interface OrderTrackingProps {
  orderId: string;
  orderMethod: 'delivery' | 'collection';
  isOpen: boolean;
  onClose: () => void;
}
```

**Features:**
- Status progress bar (pending → preparing → ready → delivered/collected)
- Driver information display (for delivery orders)
- ETA countdown
- "Track Driver" button integration

#### `DriverLocationMap.tsx`
Google Maps integration for live driver tracking.

**Props:**
```typescript
interface DriverLocationMapProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**Features:**
- Real-time driver marker updates
- Route polyline display
- ETA calculation using Google Directions API
- Restaurant and delivery location markers

### State Management

The application uses **TanStack Query** for server state:

```typescript
// Query client configuration
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
- `/api/restaurants/` - Restaurant list
- `/api/restaurants/{id}/menu/` - Restaurant menu
- `/api/orders/` - User orders
- `/api/orders/{id}/` - Order details

---

## Backend Documentation

### Django Apps

#### `accounts` - User Authentication

**Models:**
```python
class CustomUser(AbstractBaseUser, PermissionsMixin):
    """Custom user model with role-based access."""
    ROLE_CHOICES = ("customer", "restaurant", "driver", "admin")
    
    id: UUID                    # Primary key
    email: str                  # Unique email (username)
    first_name: str
    last_name: str
    phone_number: str
    role: str                   # User role
    is_active: bool
    is_staff: bool

class Address(Model):
    """Saved user addresses for delivery."""
    user: ForeignKey(CustomUser)
    label: str                  # "home", "work", etc.
    address_text: str
    lat: float
    lng: float

class BlacklistedToken(Model):
    """JWT tokens that have been invalidated."""
    token: str
    blacklisted_at: datetime
```

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/accounts/register/` | User registration |
| POST | `/api/accounts/login/` | User login (returns JWT) |
| POST | `/api/accounts/logout/` | Logout (blacklist token) |
| GET | `/api/accounts/profile/` | Get current user |
| PATCH | `/api/accounts/profile/` | Update profile |
| GET/POST | `/api/accounts/addresses/` | Manage addresses |

#### `restaurants` - Restaurant Management

**Models:**
```python
class Restaurant(Model):
    """Restaurant profile and settings."""
    id: UUID
    name: str
    owner: ForeignKey(CustomUser)
    email: str
    phone: str
    location: str
    description: str
    profile_image: ImageField
    is_approved: bool           # Admin approval status
    is_open: bool               # Currently accepting orders
    lat: float                  # Coordinates for delivery
    lng: float
    external_api_url: str       # Optional: external menu API
    external_api_key: str

class CategoryType(Model):
    """Menu category (e.g., "Main Course", "Drinks")."""
    name: str
    restaurant: ForeignKey(Restaurant)
    order: int                  # Display order

class MenuItem(Model):
    """Individual menu item."""
    id: UUID
    name: str
    restaurant: ForeignKey(Restaurant)
    category: ForeignKey(CategoryType)
    price: Decimal
    description: str
    item_image: ImageField      # Required
    available: bool
```

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/restaurants/` | List all restaurants |
| GET | `/api/restaurants/{id}/` | Restaurant details |
| GET | `/api/restaurants/{id}/menu/` | Restaurant menu |
| POST | `/api/restaurants/` | Create restaurant (auth) |
| PATCH | `/api/restaurants/{id}/` | Update restaurant |
| POST | `/api/restaurants/{id}/menu-items/` | Add menu item |
| PATCH | `/api/restaurants/orders/{id}/status/` | Update order status |

#### `orders` - Order Processing

**Models:**
```python
class Order(Model):
    """Customer order."""
    STATUS_CHOICES = (
        'pending_payment', 'paid', 'preparing', 'ready',
        'collected', 'assigned', 'out_for_delivery', 
        'delivered', 'cancelled'
    )
    METHOD_CHOICES = ('delivery', 'collection')
    
    id: UUID
    customer: ForeignKey(CustomUser)
    restaurant: ForeignKey(Restaurant)
    status: str
    method: str                 # delivery or collection
    total_fee: Decimal
    tip: Decimal
    delivery_fee: Decimal
    delivery_address: str
    delivery_lat: float
    delivery_lng: float
    driver: ForeignKey(CustomUser, null=True)
    driver_name: str
    driver_phone: str
    driver_vehicle: str
    created: datetime

class OrderItem(Model):
    """Individual item in an order."""
    order: ForeignKey(Order)
    menu_item: ForeignKey(MenuItem)
    quantity: int
    
    def price(self):
        return self.menu_item.price * self.quantity
```

**API Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders/` | List user orders |
| GET | `/api/orders/{id}/` | Order details |
| POST | `/api/orders/` | Create order |
| POST | `/api/orders/{id}/assign-driver/` | Assign driver |
| PATCH | `/api/orders/{id}/status/` | Update status |

#### `drivers` - Driver Management

**Models:**
```python
class Driver(Model):
    """Driver profile and documents."""
    user: OneToOneField(CustomUser)
    license_number: str
    license_photo: ImageField
    vehicle_details: str
    vehicle_photo: ImageField
    is_verified: bool           # Admin verification
    is_available: bool          # Currently accepting orders
    current_lat: float
    current_lng: float

class DriverFinance(Model):
    """Driver earnings tracking."""
    driver: ForeignKey(Driver)
    order: ForeignKey(Order)
    amount: Decimal
    date: datetime

class DriverRating(Model):
    """Customer ratings for drivers."""
    driver: ForeignKey(Driver)
    order: ForeignKey(Order)
    rating: int                 # 1-5 stars
    comment: str
```

#### `payments` - Payment Processing

**Models:**
```python
class Payment(Model):
    """Payment transaction record."""
    id: UUID
    order: ForeignKey(Order)
    amount: Decimal
    status: str                 # pending, completed, failed
    payment_method: str         # ecocash, onemoney, etc.
    poll_url: str               # Paynow poll URL
    created: datetime
```

**Paynow Integration:**
```python
# paynow_utils.py
def initiate_payment(order, phone_number, payment_method):
    """Initialize Paynow mobile payment."""
    paynow = Paynow(
        integration_id=settings.PAYNOW_INTEGRATION_ID,
        integration_key=settings.PAYNOW_INTEGRATION_KEY,
        return_url=settings.PAYNOW_RETURN_URL,
        result_url=settings.PAYNOW_RESULT_URL
    )
    # ... creates payment and returns redirect URL
```

### Redis Publisher

The `realtime/redis_publisher.py` module publishes events to Redis:

```python
class RedisPublisher:
    """Publishes order events to Redis for realtime server."""
    
    def publish_delivery_order(self, order_data: dict):
        """Publish new delivery order for driver matching."""
        self.redis.publish('orders.delivery.created', json.dumps(order_data))
    
    def publish_status_change(self, order_id: str, status: str):
        """Broadcast order status change."""
        self.redis.publish('orders.status.changed', json.dumps({
            'orderId': order_id,
            'status': status
        }))
```

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

  // Register driver when they come online
  async registerDriver(driverId, socketId, driverData)
  
  // Update driver's GPS location (called every 5 seconds)
  async updateLocation(driverId, lat, lng)
  
  // Set driver availability status
  async setDriverStatus(driverId, status, orderId)
  
  // Remove driver when they go offline
  async removeDriver(socketId)
  
  // Find nearest available drivers using Haversine formula
  async findNearestAvailableDrivers(lat, lng, excludeDriverIds, limit)
  
  // Calculate distance between two coordinates
  calculateDistance(lat1, lng1, lat2, lng2)
}
```

#### `OrderService.js`
Manages delivery orders and driver matching.

```javascript
class OrderService {
  constructor(redisClient, driverService) {
    this.redis = redisClient;
    this.driverService = driverService;
    this.activeOrders = new Map();    // Active order cache
    this.pendingOffers = new Map();   // Pending driver offers
    this.orderRejections = new Map(); // Track rejected offers
  }

  // Handle new delivery order from Redis
  static async handleNewDeliveryOrder(io, redisClient, orderData)
  
  // Find and offer order to nearest available driver
  async findAndOfferToDriver(io, order, excludeDriverIds)
  
  // Process driver accepting an offer
  async handleDriverAccept(io, driverId, orderId, driverData)
  
  // Process driver rejecting an offer
  async handleDriverReject(io, driverId, orderId)
  
  // Update order status and notify customer
  async updateOrderStatus(io, orderId, status, driverLocation)
  
  // Calculate ETA for delivery
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

### Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CustomUser    │────<│     Address     │     │ BlacklistedToken│
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (UUID) PK    │     │ id (int) PK     │     │ id (int) PK     │
│ email           │     │ user_id FK      │     │ token           │
│ first_name      │     │ label           │     │ blacklisted_at  │
│ last_name       │     │ address_text    │     └─────────────────┘
│ phone_number    │     │ lat, lng        │
│ role            │     └─────────────────┘
│ password        │
└────────┬────────┘
         │
    ┌────┴────┬─────────────────┬─────────────────┐
    │         │                 │                 │
    ▼         ▼                 ▼                 ▼
┌───────┐ ┌───────┐      ┌───────────┐    ┌────────────┐
│Driver │ │Order  │      │Restaurant │    │ Order      │
│(1:1)  │ │(M:1)  │      │  (M:1)    │    │ (customer) │
└───────┘ └───┬───┘      └─────┬─────┘    └────────────┘
              │                │
              │    ┌───────────┴───────────┐
              │    │                       │
              ▼    ▼                       ▼
         ┌────────────┐           ┌────────────────┐
         │  Order     │           │  CategoryType  │
         ├────────────┤           ├────────────────┤
         │ id (UUID)  │           │ id (int) PK    │
         │ customer   │──────────>│ name           │
         │ restaurant │           │ restaurant_id  │
         │ driver     │           └───────┬────────┘
         │ status     │                   │
         │ method     │                   ▼
         │ total_fee  │           ┌────────────────┐
         │ tip        │           │   MenuItem     │
         │ delivery_* │           ├────────────────┤
         └─────┬──────┘           │ id (UUID) PK   │
               │                  │ name           │
               ▼                  │ restaurant_id  │
         ┌───────────┐            │ category_id    │
         │ OrderItem │            │ price          │
         ├───────────┤            │ item_image     │
         │ id (int)  │            │ available      │
         │ order_id  │            └────────────────┘
         │ menu_item │
         │ quantity  │
         └───────────┘
```

---

## API Reference

### Authentication Headers

All protected endpoints require JWT authentication:

```
Authorization: Bearer <jwt_token>
```

### Response Format

**Success:**
```json
{
  "data": { ... },
  "message": "Success"
}
```

**Error:**
```json
{
  "error": "Error message",
  "detail": "Detailed description"
}
```

### Common HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

## Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │     │   Backend    │     │   Database   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  POST /register    │                    │
       │───────────────────>│                    │
       │                    │  Create User       │
       │                    │───────────────────>│
       │                    │<───────────────────│
       │  { user, token }   │                    │
       │<───────────────────│                    │
       │                    │                    │
       │  Store token in    │                    │
       │  localStorage      │                    │
       │                    │                    │
       │  GET /profile      │                    │
       │  + Authorization   │                    │
       │───────────────────>│                    │
       │                    │  Validate JWT      │
       │                    │  Fetch User        │
       │                    │───────────────────>│
       │                    │<───────────────────│
       │  { user }          │                    │
       │<───────────────────│                    │
```

---

## Order Flow

### Delivery Order Flow

```
1. CUSTOMER places order
   └─> Status: pending_payment
   
2. CUSTOMER pays via Paynow
   └─> Status: paid
   └─> Customer notified of payment success
   
3. RESTAURANT sees new order
   └─> Restaurant reviews order details
   
4. RESTAURANT clicks "Preparing"
   └─> Status: preparing
   └─> Redis publishes: orders.delivery.created
   └─> Realtime server starts driver matching
   
5. DRIVER receives offer
   └─> Shows: restaurant, customer, distance, price
   └─> 30-second timeout
   
6. DRIVER accepts offer
   └─> Status: assigned
   └─> Customer notified of driver details
   └─> Driver sees navigation to restaurant
   
7. DRIVER picks up order
   └─> Status: out_for_delivery
   └─> Customer sees live driver location
   
8. DRIVER delivers order
   └─> Status: delivered
   └─> Customer prompted to rate driver
```

### Collection Order Flow

```
1. CUSTOMER places order (method: collection)
   └─> Status: pending_payment
   
2. CUSTOMER pays via Paynow
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
Frontend                    Realtime Server               Backend
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

---

## Environment Variables

### Frontend (.env)
```env
VITE_GOOGLE_MAPS_API_KEY=     # Google Maps JavaScript API key
VITE_API_URL=                 # Backend API URL
VITE_REALTIME_URL=            # Realtime server URL
```

### Backend (ZimFeast/.env)
```env
SECRET_KEY=                   # Django secret key
DEBUG=                        # Debug mode (True/False)
GOOGLE_API_KEY=               # Google Maps API key
SENDGRID_API_KEY=             # SendGrid for emails
PAYNOW_INTEGRATION_ID=        # Paynow merchant ID
PAYNOW_INTEGRATION_KEY=       # Paynow secret key
REDIS_URL=                    # Redis connection URL
DATABASE_URL=                 # Database connection
```

### Realtime Server (real-time-server/.env)
```env
GOOGLE_API_KEY=               # Google Maps API key
REDIS_URL=                    # Redis connection URL
DJANGO_URL=                   # Backend API URL
REALTIME_PORT=                # Server port (default: 3001)
```

---

## Deployment

### Production Architecture

In production, Django serves both the API and the built React frontend:

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Server                         │
│                                                              │
│  ┌────────────────────┐     ┌────────────────────┐          │
│  │  Django (Daphne)   │     │  Realtime Server   │          │
│  │    Port 5000       │     │    Port 3001       │          │
│  │                    │     │                    │          │
│  │  /api/* → REST API │     │  Socket.IO         │          │
│  │  /*     → React SPA│     │  WebSocket         │          │
│  └────────────────────┘     └────────────────────┘          │
│             │                         │                      │
│             └───────────┬─────────────┘                      │
│                         │                                    │
│                  ┌──────▼──────┐                             │
│                  │    Redis    │                             │
│                  └─────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### Build Commands

```bash
# Build frontend
npm run build

# Start production server
bash start_production.sh
```

### start_production.sh
```bash
#!/bin/bash
npm run build
cd ZimFeast
daphne -b 0.0.0.0 -p 5000 ZimFeast.asgi:application
```

---

## Troubleshooting Guide

### Common Issues

1. **"Redis connection refused"**
   - Ensure Redis is running: `redis-cli ping`
   - Check REDIS_URL environment variable

2. **"CORS errors"**
   - Verify Django CORS settings in settings.py
   - Use correct origin URLs

3. **"JWT token expired"**
   - Frontend should handle 401 and redirect to login
   - Token lifetime configurable in settings

4. **"Google Maps not loading"**
   - Verify API key is valid
   - Check API key has required APIs enabled
   - Check billing is active on Google Cloud

5. **"Socket.IO connection failed"**
   - Verify realtime server is running
   - Check firewall/proxy settings
   - Verify CORS configuration

---

## Contributing

### Code Style

- **Python**: Follow PEP 8, use type hints
- **JavaScript**: ES6+, use async/await
- **TypeScript**: Strict mode, proper interfaces
- **React**: Functional components, custom hooks

### Git Workflow

1. Create feature branch from `main`
2. Make changes with clear commits
3. Test locally with all three servers
4. Submit pull request for review

---

## License

Proprietary - All rights reserved.

---

*Documentation last updated: January 2026*
