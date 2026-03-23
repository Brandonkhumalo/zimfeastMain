# ZIMFEAST

**Food Delivery Platform**
**Taste the Extraordinary**

---

**APP DESIGN & DEVELOPMENT SPECIFICATION**
**Version 1.0 | Confidential**

**Tishanyq Digital**
**Harare, Zimbabwe**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Brand Identity & Design Guidelines](#2-brand-identity--design-guidelines)
3. [User Types & Apps](#3-user-types--apps)
4. [Customer App — Screen Specifications](#4-customer-app--screen-specifications)
5. [Driver App — Screen Specifications](#5-driver-app--screen-specifications)
6. [Restaurant Dashboard — Screen Specifications](#6-restaurant-dashboard--screen-specifications)
7. [Admin Panel — Screen Specifications](#7-admin-panel--screen-specifications)
8. [Technical Specifications](#8-technical-specifications)
9. [AWS Deployment Architecture](#9-aws-deployment-architecture)
10. [Deliverables & Current Implementation Status](#10-deliverables--current-implementation-status)
11. [Timeline & Priorities](#11-timeline--priorities)
12. [Contact & Project Owner](#12-contact--project-owner)

---

## 1. Project Overview

### 1.1 Platform Summary

| Field | Detail |
|-------|--------|
| Platform Name | ZimFeast |
| Tagline | Taste the Extraordinary |
| Business Type | Three-sided food delivery marketplace (Customers, Restaurants, Drivers) |
| Target Market | Zimbabwe — nationwide rollout, starting with Harare |
| Client / Owner | Tishanyq Digital, Harare, Zimbabwe |
| Currency | USD (primary), ZiG (Zimbabwe Gold) support planned |
| Payment Gateway | Paynow — Zimbabwe-specific (EcoCash, OneMoney, InnBucks) |
| Platform Type | Web App (React SPA) + Android Customer App + Android Driver App + Restaurant Dashboard + Admin Panel |

### 1.2 Platform Description

ZimFeast is a food delivery marketplace that connects three primary user types within the Zimbabwean market:

- **Customers** browse restaurant menus, place orders, select delivery or pickup, pay via Paynow-integrated mobile money (EcoCash, OneMoney, InnBucks) or vouchers, and track their delivery in real-time on a live map.
- **Restaurants** receive and manage incoming orders through a real-time dashboard with sound alerts, maintain their menu and pricing, view financial summaries, and print receipts for kitchen and customer records.
- **Drivers** accept delivery jobs pushed via Socket.IO, navigate to pickup and drop-off locations with in-app turn-by-turn guidance, update delivery status at each stage, capture proof-of-delivery photos, and track their daily earnings.

The platform is built on a microservices architecture consisting of six backend services: three Django services (auth, restaurant, payment) and three Go services (order, driver, realtime). All services are containerized with Docker and orchestrated via Docker Compose behind an Nginx API gateway. Real-time communication is handled through Socket.IO and Redis pub/sub. Google Maps powers location services, geocoding, and navigation across all client applications.

### 1.3 Additional User Types

| User Type | Description |
|-----------|-------------|
| Admin | Full platform management — user/restaurant/driver/order oversight, financial analytics, promo management, driver approval workflow, banner campaigns, system health monitoring |
| Corporate Admin | Multi-employee company accounts with centralized billing, employee spending limits, and corporate order management |

### 1.4 Architecture Summary

| Layer | Technology |
|-------|-----------|
| Frontend (Web) | React 18, TypeScript, Vite, Tailwind CSS, Radix UI / shadcn, TanStack Query |
| Frontend (Mobile) | Android Native — Java, XML layouts, Material Design 3 |
| Backend (Django) | 3 Django 4.2 microservices: auth-service (8001), restaurant-service (8002), payment-service (8005) |
| Backend (Go) | 3 Go microservices: order-service (8003), driver-service (8004), realtime-service (3001) |
| Database | PostgreSQL — 1 database per service (full isolation) |
| Cache / PubSub | Redis 7 |
| Authentication | Stateless JWT — shared secret, independently validated by each service |
| API Gateway | Nginx — routes `/api/*` to correct microservice |
| Maps & Navigation | Google Maps SDK (Android), Google Maps JavaScript API (Web), Directions API, Places API, Geocoding API |
| Payments | Paynow (Zimbabwe) — EcoCash, OneMoney, InnBucks |
| Real-time | Socket.IO via realtime-service (Go), Redis pub/sub for inter-service event propagation |
| Containers | Docker + Docker Compose with auto-scaling support |
| Infrastructure | AWS (Terraform-managed) |

### 1.5 Service Communication

| Pattern | Mechanism | Used By |
|---------|-----------|---------|
| Synchronous REST | HTTP calls with `X-Service-Key` header | Django services via `shared/service_client.py`, Go services via `go-shared/` |
| Asynchronous Events | Redis pub/sub channels | All services — order state changes, driver location updates, payment confirmations |
| Real-time Push | Socket.IO WebSocket connections | Customer order tracking, driver delivery offers, restaurant new-order alerts |
| Authentication | Stateless JWT Bearer tokens | All client-facing endpoints — each service validates independently |
| Data References | Cross-service UUID references (no foreign keys) | Orders reference user_id, restaurant_id, driver_id from other services |

---

## 2. Brand Identity & Design Guidelines

### 2.1 Color Palette

The ZimFeast color system is built around a warm, energetic orange palette that conveys appetite appeal, speed, and premium quality. All colors are defined in the Android `colors.xml` and Tailwind CSS configuration for cross-platform consistency.

| Color | Hex Code | CSS Variable | Usage |
|-------|----------|-------------|-------|
| Primary Orange | `#F97316` | `--primary` | Main CTA buttons, highlights, active states, gradient starts, navigation accents |
| Dark Orange | `#EA580C` | `--primary-dark` | Hover states, pressed states, gradient endpoints, button hover |
| Deep Orange | `#C2410C` | `--accent-deep` | Strong accents, gradient variants, emphasis elements |
| Secondary Orange | `#FB923C` | `--secondary` | Secondary accents, lighter highlights, inactive tab indicators |
| Light Orange | `#FDBA74` | `--accent-light` | Subtle backgrounds, secondary variants, soft badges |
| Background | `#F9FAFB` | `--background` | Main screen backgrounds, page containers |
| Surface White | `#FFFFFF` | `--surface` | Cards, modals, panels, dialog backgrounds |
| Dark Text | `#1F2937` | `--text-primary` | Headings, body text, primary content |
| Secondary Text | `#6B7280` | `--text-secondary` | Subtext, captions, timestamps, metadata |
| Tertiary Text | `#9CA3AF` | `--text-tertiary` | Placeholders, hint text, disabled labels |
| Divider | `#E5E7EB` | `--border` | Card borders, section dividers, input borders |
| Error / Alert | `#EF4444` | `--destructive` | Error messages, cancellation badges, form validation, delete actions |
| Success | `#22C55E` | `--success` | Order confirmed, delivered status, online indicators, completion states |
| Warning | `#F59E0B` | `--warning` | Pending states, attention badges, expiring timers |
| Rating Star | `#FBBF24` | `--rating` | Star ratings across all interfaces |
| Link Blue | `#2563EB` | `--link` | Clickable links, navigation text, informational callouts |

### 2.2 Typography

| Category | Font Family | Weights | Usage |
|----------|------------|---------|-------|
| Primary | Plus Jakarta Sans | 200 (ExtraLight) through 800 (ExtraBold) | All headings, body text, buttons, labels — primary typeface across web and marketing |
| Secondary | Inter, DM Sans | 400–700 | Alternative body text, data tables, form inputs |
| Monospace | JetBrains Mono, Fira Code | 400–600 | Order IDs, financial figures, code displays, receipt formatting |
| Mobile System | System sans-serif | Material Design 3 type scale | Android native app text — inherits device font with MD3 sizing |

**Type Scale (Web)**

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| Page Title (H1) | Plus Jakarta Sans | 36px | 800 | 1.2 |
| Section Title (H2) | Plus Jakarta Sans | 28px | 700 | 1.3 |
| Card Title (H3) | Plus Jakarta Sans | 20px | 600 | 1.4 |
| Body | Plus Jakarta Sans | 16px | 400 | 1.5 |
| Caption | Plus Jakarta Sans | 14px | 400 | 1.5 |
| Small / Badge | Plus Jakarta Sans | 12px | 500 | 1.4 |

**Mobile Type Scale**: Follows Material Design 3 type scale definitions with `sp` units. All text sizes defined in `dimens.xml` for consistency.

### 2.3 Icons & Imagery

| Platform | Icon System | Details |
|----------|-----------|---------|
| Web | Lucide React | Outlined, consistent stroke weight, used for all navigation and UI icons |
| Web (supplementary) | Font Awesome 6.5 | Brand icons, social media, extended icon set |
| Android | Material Design 3 Icons | System-consistent, vector drawables (XML), supports tinting |
| Android (custom) | Vector Drawables | Custom icons (e.g., `ic_my_location.xml`) as resolution-independent SVG-based XML |

**Photography Style**
- Food imagery: Bright, high-contrast, warm tones, appetizing close-ups
- Restaurant photos: Full-width hero banners with overlay gradients for text legibility
- Loaded via Glide (Android) with placeholder shimmer effects

**UI Visual Effects**
- Glass morphism: Translucent panels with backdrop blur for depth and modernity
- Orange gradients: Linear gradients from Primary Orange to Dark Orange on headers, CTAs, and hero sections
- Rounded corners: 24dp on cards (Android), `rounded-2xl` on web cards
- Shadows: Subtle elevation shadows on cards and floating action buttons
- Animations: Float/hover animations, shimmer loading skeletons, pulse effects on live status indicators

### 2.4 Overall UI Tone

The ZimFeast interface prioritizes clarity, warmth, and premium feel:

| Principle | Implementation |
|-----------|---------------|
| Clean & Premium | Orange palette feels warm and energetic without being cheap — generous whitespace, consistent spacing |
| Glass Morphism | Translucent overlay panels with blur for depth, used on navigation overlays and modal backgrounds |
| Dark Mode | Full dark mode support — web (Tailwind `class` strategy toggle), Android (night resource qualifiers) |
| Mobile-First Responsive | All web layouts designed mobile-first with `sm:` / `md:` / `lg:` Tailwind breakpoints |
| Material Design 3 | Android apps follow MD3 guidelines with custom orange theme, dynamic color where supported |
| Minimal Clutter | Each screen shows only what is needed — progressive disclosure for secondary actions |
| Consistent Feedback | Toast notifications, loading spinners, skeleton screens, and sound alerts for state changes |

---

## 3. User Types & Apps

ZimFeast serves its marketplace through five separate interfaces, each tailored to the specific workflow of its user type.

### 3.1 Customer App (Android Native — Java)

| Attribute | Detail |
|-----------|--------|
| Platform | Android (minSdk 24+) |
| Language | Java |
| UI Framework | XML layouts, Material Design 3, ConstraintLayout |
| Architecture | Activity-based with Retrofit (REST), Room (local DB), Socket.IO (real-time) |
| Key Libraries | Retrofit 2, Room, Glide, Google Maps SDK, Google Places API, Socket.IO Client, Biometric API |
| Local Storage | Room database (cart items, saved addresses), EncryptedSharedPreferences (auth tokens, biometric flag) |

**Screen Count**: 15 screens/activities

| Screen | Activity Class | Purpose |
|--------|---------------|---------|
| Splash | `SplashActivity` | JWT validation, biometric prompt, auto-routing |
| Landing | `LandingActivity` | First launch — cuisine carousel, curated restaurants, feature highlights |
| Register | `RegisterActivity` | Account creation with role selection and referral code |
| Login | `LoginActivity` | Email/password authentication, biometric login on return visits |
| Home | `CustomerActivity` | Restaurant browsing — filters, search, grids, top rated, nearby |
| Menu | `MenuActivity` | Restaurant detail — cover image, menu items, add to cart |
| Cart | `CartActivity` | Cart management — quantities, delivery/pickup toggle, address, scheduling, tips |
| Address Picker | `AddressPickerActivity` | Google Places autocomplete, draggable map pin, reverse geocoding |
| Address Book | `AddressBookActivity` | Saved addresses CRUD |
| Checkout | `CheckoutActivity` | Payment method selection, promo codes, referral credits, voucher balance |
| PayNow WebView | `PayNowWebViewActivity` | Embedded Paynow gateway (EcoCash, OneMoney, InnBucks) |
| Order Tracking | `OrderTrackingActivity` | Live Google Map with driver tracking, status timeline, driver info, ETA |
| Order History | `OrderHistoryActivity` | Past orders list with status badges |
| Referral | `ReferralActivity` | Referral code display, share link, credits tracking |
| Settings | `SettingsActivity` | Biometric toggle, WhatsApp support link |

**Key Capabilities**:
- Room database-backed cart with offline persistence
- Socket.IO live order tracking with Google Maps markers (blue=driver, green=restaurant, red=delivery)
- Biometric authentication via Android BiometricPrompt API with EncryptedSharedPreferences
- Paynow payment integration supporting EcoCash, OneMoney, InnBucks via WebView and mobile flows
- Google Places autocomplete bounded to Zimbabwe for address entry
- Distance-based delivery fee calculation
- Promo code validation and referral credit system (15% discount, ZF-XXXXXX format codes)
- Scheduled orders with Material date and time pickers

### 3.2 Customer Web App (React SPA)

| Attribute | Detail |
|-----------|--------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) |
| State Management | TanStack Query (server state), React hooks (local state) |
| Routing | Wouter (lightweight client-side router) |
| Key Path | `/customer` (role-guarded) |

**Components & Features**:

| Feature | Component(s) | Details |
|---------|-------------|---------|
| Restaurant Browsing | `RestaurantGrid`, `AllRestaurants`, `TopRestaurants` | Paginated grid, top-rated carousel, nearby sorting by geolocation |
| Cuisine Filtering | `QuickFilters` | Horizontal filter chips: All, Fast Food, Traditional, Breakfast, Pizza, Chinese, Indian, Lunch Pack |
| Search | `Header` (integrated search) | Real-time text search across restaurant names |
| Menu & Cart | `MenuDialog`, `CartComponent` | Modal menu overlay, quantity controls, running total |
| Chef Zim AI | `ChefZimCard`, `ChefZimDialog`, `ChefZimResults` | AI-powered food recommendations — conversational dialog with personalized suggestions |
| Banner Promotions | `BannerCarousel` | Auto-rotating promotional banners from admin-managed campaigns |
| Referral System | `ReferralCard` | Referral code display with social sharing (WhatsApp, copy link) |
| Order Tracking | `OrderTracking`, `OrderTrackingButton` | Live order status with map, floating tracking button for active orders |
| Rating | `RatingDialog` | Post-delivery rating dialog — separate ratings for restaurant and driver (1-5 stars + comment) |
| Checkout | `Checkout` page | Full checkout flow with Paynow integration |
| Payment Return | `PaymentReturn` page | Handles Paynow callback/redirect after payment |
| Offline Support | `OfflineBanner` | Network status detection with banner notification |
| WhatsApp Support | Navbar integration | Opens `wa.me/263781603382` for direct customer support |

### 3.3 Driver App (Android Native — Java)

| Attribute | Detail |
|-----------|--------|
| Platform | Android (minSdk 24+) |
| Language | Java |
| UI Framework | XML layouts, Material Design 3, ConstraintLayout |
| Architecture | Activity-based with Retrofit, Socket.IO, Foreground Service |
| Key Libraries | Retrofit 2, Google Maps SDK, Google Directions API, Socket.IO Client, FusedLocationProvider, CameraX |
| Background Services | `LocationService` (foreground), `DeliveryNotificationService` |

**Screen Count**: 4 main screens + 2 background services

| Screen / Service | Class | Purpose |
|-----------------|-------|---------|
| Login | `LoginActivity` | Driver authentication, role validation |
| Home | `MainActivity` | Delivery offers, daily finances, online toggle, bottom navigation (Home/Earnings/Settings) |
| Active Delivery | `DeliveryActivity` | In-app map navigation, status progression, proof of delivery, customer contact |
| Order History | `OrderHistoryActivity` | Completed deliveries list |
| Location Service | `LocationService` | Foreground service — adaptive GPS intervals, Socket.IO location emission |
| Notification Service | `DeliveryNotificationService` | Push notifications for new delivery offers |

**Key Capabilities**:
- Real-time delivery offers via Socket.IO with 30-second countdown timer
- In-app Google Maps with route polyline, ETA/distance overlay, and re-center button
- `NavigationHelper` class manages map rendering, route drawing, and directions API calls
- 5-phase delivery status progression with server sync and Socket.IO emission
- Proof of delivery photo capture via device camera with server upload
- Background location tracking as a foreground service (adaptive: 10s active / 60s idle)
- Daily finance dashboard (earnings, deliveries, tips, hours online, average rating)
- Bottom navigation with three tabs: Home, Earnings, Settings
- Edit profile dialog, WhatsApp support, connection status indicator
- Recent reviews display on earnings tab
- Network monitoring with offline Snackbar alerts

### 3.4 Restaurant Dashboard (React Web)

| Attribute | Detail |
|-----------|--------|
| Framework | React 18 + TypeScript |
| Key Path | `/restaurant` (role-guarded) |
| Layout | `DashboardLayout` with tabbed interface |
| Real-time | WebSocket connection for live order updates |

**Tabs & Components**:

| Tab | Components | Features |
|-----|-----------|----------|
| Dashboard | `DashboardHeader`, `StatsCards`, `LiveOrders` | Restaurant open/close toggle, today's stats (orders, revenue, rating, avg order value, preparing/pending/completed counts), live order cards with status actions |
| Menu | `MenuManagement` | Full CRUD for menu items — name, description, price, image, availability toggle |
| Finance | `RestaurantFinance` | Revenue tracking, order-by-order breakdown, settlement summaries |
| Settings | `RestaurantSettings`, `ExternalAPIDialog` | Restaurant profile editing, external API integration for chain restaurants |

**Live Order Features**:

| Feature | Implementation |
|---------|---------------|
| Sound Alerts | Web Audio API ascending chime (C5-E5-G5) on new orders, mute toggle persisted in localStorage |
| Visual Flash | New order cards flash/highlight animation for immediate attention |
| Status Actions | One-click status updates: Preparing, Ready, Collected |
| Prep Timer | `PrepTimer` component — countdown timer per order for kitchen staff |
| Receipt Printing | `PrintableReceipt` — opens print dialog with formatted 80mm thermal receipt (Courier New, order items, totals, delivery method) |
| Order Filtering | Filter by status: All, Paid, Preparing, Ready, Completed |
| Pagination | Cursor-based pagination for order history |

### 3.5 Admin Panel (React Web)

| Attribute | Detail |
|-----------|--------|
| Framework | React 18 + TypeScript |
| Key Path | `/admin/*` (role-guarded, admin only) |
| Layout | `AdminLayout` — collapsible sidebar with 13 navigation items, responsive mobile drawer |
| Charts | Recharts library for analytics visualizations |

**Admin Pages**:

| Page | Route | Key Features |
|------|-------|-------------|
| Dashboard | `/admin/dashboard` | Platform overview — real-time KPIs, order volume charts, revenue trends, active users |
| Orders | `/admin/orders` | All orders list with filters, search, status badges. Detail view at `/admin/orders/:id` |
| Finance | `/admin/finance` | Platform-wide financial analytics — revenue, fees, settlements, payment method breakdown |
| Users | `/admin/users` | User management — list, search, filter by role, view/edit profiles. Detail at `/admin/users/:id` |
| Restaurants | `/admin/restaurants` | Restaurant management — approval status, performance metrics. Detail at `/admin/restaurants/:id` |
| Drivers | `/admin/drivers` | Driver management — status, ratings, earnings history. Detail at `/admin/drivers/:id` |
| Approvals | `/admin/drivers/pending` | Pending driver approval workflow — review license, vehicle details, ID/vehicle photos, approve/reject |
| Banners | `/admin/banners` | Promotional banner campaign management — create, schedule, target audience, image upload |
| Corporate | `/admin/corporate` | Corporate account management — company profiles, employee spending limits, billing |
| Promos | `/admin/promos` | Promo code management — create codes, set discount type/value, expiry, usage limits |
| Reviews | `/admin/reviews` | Platform-wide review moderation — filter, flag, respond |
| System | `/admin/system` | System health monitoring — service status, error rates, performance metrics |
| Settings | `/admin/settings` | Admin account settings, platform configuration |

**Admin Sidebar Navigation**:

| Icon | Label | Route |
|------|-------|-------|
| LayoutDashboard | Dashboard | `/admin/dashboard` |
| ShoppingBag | Orders | `/admin/orders` |
| DollarSign | Finance | `/admin/finance` |
| Users | Users | `/admin/users` |
| Store | Restaurants | `/admin/restaurants` |
| Truck | Drivers | `/admin/drivers` |
| UserCheck | Approvals | `/admin/drivers/pending` |
| Image | Banners | `/admin/banners` |
| Building2 | Corporate | `/admin/corporate` |
| Tag | Promos | `/admin/promos` |
| Star | Reviews | `/admin/reviews` |
| Activity | System | `/admin/system` |
| Settings | Settings | `/admin/settings` |

**Admin Capabilities**:
- CSV/Excel data export via `ExportButton` component and `exportUtils.ts`
- Real-time analytics dashboards with Recharts (line, bar, area, pie charts)
- Role-based access control — only `admin` role can access `/admin/*` routes
- Responsive design — collapsible sidebar on desktop, slide-out drawer on mobile
- Global search across all entities
- Legacy admin routes maintained for backward compatibility (`/zimfeast/admin/*`)

---

## 4. Customer App — Screen Specifications

### 4.1 Onboarding & Authentication

#### 4.1.1 Splash Screen (`SplashActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Layout | ZimFeast logo centered on branded background | `activity_splash.xml` |
| Duration | 1500ms display before authentication check | `Handler.postDelayed` |
| Token Validation | Checks `TokenManager.isLoggedIn()` and `isTokenValid()` | JWT expiry validation |
| Biometric Check | If biometric enabled and device supports it, shows `BiometricPrompt` | `BiometricHelper.showBiometricPrompt()` |
| Backend Verification | Calls `GET /api/auth/profile/` to validate token with server | Falls back to cached token on network error |
| Routing Logic | Valid token -> `CustomerActivity` / Invalid/expired -> `LandingActivity` | Clears tokens on 401/403 response |
| Offline Handling | If network fails but local token is valid, proceeds to home screen | Graceful degradation |

#### 4.1.2 Landing Screen (`LandingActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Auto-scroll Cuisine Carousel | 10 cuisine categories with food imagery (Burger, Pizza, Sushi, Tacos, Salad, Chicken, Pasta, Dessert, Coffee, Indian) | Unsplash images, duplicated for infinite scroll effect, auto-scrolling with `Handler` |
| Curated Restaurant Showcase | 5 premium restaurants: Neon Umami Sushi (4.8), Obsidian Burger Lab (4.9), Lush Greenery Bowl (4.6), Inferno Pizza Co. (4.7), Spice Route Delhi (4.9) | Horizontal scrolling `CuratedSpotsAdapter` cards |
| Feature Highlights | Speed, Security, Premium quality feature cards with images | Loaded via Glide from Unsplash |
| Search Container | Tappable search bar — redirects to Login (requires auth) | Visual prompt to engage |
| Get Started Button (top) | Routes to `RegisterActivity` | Primary CTA |
| Login Button | Routes to `LoginActivity` | Secondary CTA |
| Get Started Button (bottom) | Routes to `RegisterActivity` | Repeated CTA at page end |
| Auth Check | If already logged in (`TokenManager.isLoggedIn()`), auto-redirects to `CustomerActivity` | Skip landing for returning users |

#### 4.1.3 Sign Up (`RegisterActivity`)

| Field | Type | Validation | Notes |
|-------|------|-----------|-------|
| First Name | EditText | Required, non-empty | `et_first_name` |
| Last Name | EditText | Required, non-empty | `et_last_name` |
| Email | EditText | Required, non-empty | `et_email` |
| Phone Number | EditText | Optional | `et_phone` — Zimbabwe format |
| Password | EditText | Required, non-empty | `et_password` |
| Role Selector | Spinner | Customer / Restaurant / Driver | Maps to `customer`, `restaurant`, `driver` API values |
| Referral Code | EditText | Optional, auto-uppercased | `et_referral_code` — `ZF-XXXXXX` format |
| Register Button | Button | Submits to `POST /api/auth/register/` | Shows loading state during request |
| Login Link | TextView | Navigates back to `LoginActivity` | `tv_login` — "Already have an account?" |
| Post-Registration | Auto-login, saves JWT tokens via `TokenManager` | Prompts biometric setup via `BiometricHelper` if device supports it |

#### 4.1.4 Login (`LoginActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Email | EditText input | Required |
| Password | EditText input (password masked) | Required |
| Login Button | Calls `POST /api/auth/login/`, saves JWT access + refresh tokens | `TokenManager` stores in `EncryptedSharedPreferences` |
| Biometric Login | On subsequent visits, `SplashActivity` handles biometric before backend call | Uses Android BiometricPrompt API |
| Error Handling | Toast messages for invalid credentials, network errors | Graceful failure |

#### 4.1.5 Location Permission

| Element | Details | Notes |
|---------|---------|-------|
| System Dialog | Requests `ACCESS_FINE_LOCATION` permission | Android runtime permission |
| Purpose | Required for: delivery fee calculation (distance-based), nearby restaurant sorting, current location in address picker | `FusedLocationProviderClient` |
| Fallback | App functions without location — nearby section hidden, manual address entry required | Non-blocking permission |

### 4.2 Home Screen (`CustomerActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| **Toolbar** | Custom toolbar with hamburger menu icon | `setSupportActionBar`, no title |
| **Navigation Drawer** | Slide-out `DrawerLayout` with `NavigationView` | Contains: user info header, Orders, Favorites, Referrals, Help, Settings, Logout |
| **Search Bar** | `EditText` with `TextWatcher` for real-time filtering | Filters restaurants by name across all sections |
| **Cuisine Filter Row** | Horizontal chip/button row: All, Fast Food, Traditional, Breakfast, Pizza, Chinese, Indian, Lunch Pack | `selectedCuisine` state filters restaurant list |
| **All Restaurants Grid** | `RecyclerView` with `GridLayoutManager(2)` — paginated | `RestaurantAdapter` — shows: name, image (Glide), rating, cuisine type, distance |
| **Top Rated Section** | Horizontal `RecyclerView` with `LinearLayoutManager(HORIZONTAL)` | Filtered by rating >= 4.5, premium showcase cards |
| **Nearby Section** | Horizontal `RecyclerView`, sorted by distance to user | Requires location permission; hidden if unavailable |
| **Cart Badge** | Floating cart button with item count badge | Backed by Room database `CartItem` table, `observeCart()` LiveData |
| **Currency Toggle** | USD / ZiG currency selector | `currentCurrency` state, affects displayed prices |
| **Chef Zim AI Card** | Promotional card linking to AI recommendation dialog | Web only — not present in Android MVP |
| **Restaurant Tap** | Opens `MenuActivity` with restaurant ID | `OnRestaurantClickListener` interface |

### 4.3 Restaurant / Menu Screen (`MenuActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Restaurant Header | Full-width cover image, restaurant name, cuisine type, star rating, estimated delivery time | Hero section with gradient overlay |
| Menu Items List | Vertical `RecyclerView` — item name, description, price (USD), image, "Add to Cart" button | `MenuAdapter`, fetched from `GET /api/restaurants/{id}/menu-data/` |
| Add to Cart | Taps insert into Room `CartItem` table with `restaurantId`, `itemId`, `name`, `price`, `quantity` | Multi-restaurant cart clearing prompt if switching restaurants |
| Floating Cart Button | Anchored at bottom — shows total items count, tappable to open `CartActivity` | Badge updates via Room LiveData |
| Back Navigation | Toolbar back arrow returns to `CustomerActivity` | Standard Android back handling |

### 4.4 Cart & Checkout

#### 4.4.1 Cart Screen (`CartActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Items List | `RecyclerView` with `CartAdapter` — item name, price, quantity controls (+/-), delete button | `OnCartItemListener` callbacks update Room database |
| Order Type Toggle | Delivery / Pickup toggle | `isDelivery` flag — hides address and delivery fee for pickup |
| Delivery Address | Manual text entry + "Choose on Map" button (`AddressPickerActivity`) + "Saved Addresses" button (`AddressBookActivity`) | Google Places autocomplete in picker, bounded to Zimbabwe |
| Delivery Fee | Calculated based on distance from restaurant to delivery address | `DeliveryUtils` helper class, shown as line item |
| Tip Input | Numeric input for driver tip amount | Added to order total |
| Schedule Order | Toggle to enable scheduling + Material `DatePicker` + `TimePicker` | `isScheduled` flag, `scheduledCalendar` stores selected date/time |
| Subtotal / Total | Running calculation: subtotal + delivery fee + tip | Updates on any cart or fee change |
| Place Order Button | Creates order via API, passes `orderId` to `CheckoutActivity` | Validates address, cart not empty |
| Location Detection | Auto-requests location via `FusedLocationProviderClient`, up to 3 retry attempts | Used for delivery fee pre-calculation |

#### 4.4.2 Checkout (`CheckoutActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Order Summary | Items list with prices, subtotal, delivery fee, tip, discount, total | Read-only summary from order API |
| Payment Method | Radio group: PayNow Web / PayNow Mobile / Voucher | `selectedPaymentMethod` state |
| PayNow Web | Redirects to embedded `PayNowWebViewActivity` with Paynow gateway | EcoCash, OneMoney, InnBucks selection in gateway |
| PayNow Mobile | Provider spinner (EcoCash, OneMoney, InnBucks) + phone number input | Direct mobile money push notification to user's phone |
| Voucher | Voucher code entry + balance check | `loadVoucherBalance()` validates remaining credit |
| Voucher Top-up | Checkbox to apply voucher balance against order total | Partial voucher usage supported |
| Promo Code | Text input + "Apply" button | `PromoValidation` response — discount type (percentage/fixed), value, expiry check |
| Referral Credits | Checkbox to apply referral credits | `loadReferralCredits()` — 15% discount when credits available |
| Direct Payment Detection | Detects if payment completed without redirect (mobile push) | `isDirectPayment` flag adjusts UI flow |
| Pay Button | Initiates selected payment flow | Loading state, error handling with Toast |
| Post-Payment | Navigates to `OrderTrackingActivity` with `orderId` | On successful payment confirmation |

#### 4.4.3 PayNow WebView (`PayNowWebViewActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| WebView | Full-screen embedded Paynow payment gateway | JavaScript enabled, DOM storage enabled |
| Supported Methods | EcoCash, OneMoney, InnBucks | Zimbabwe mobile money providers |
| Success Callback | Detects Paynow success URL, returns result to `CheckoutActivity` | `WebViewClient` URL interception |
| Cancellation | Detects cancellation URL, returns cancelled result | User can press back to cancel |
| Error Handling | Network error page, retry option | Graceful WebView error handling |

### 4.5 Live Order Tracking (`OrderTrackingActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| **Google Map** | Embedded `MapView` with three markers | Blue (driver, real-time), Green (restaurant/origin), Red (delivery address/destination) |
| **Route Polyline** | Drawn from restaurant to delivery address | `PolylineOptions` connecting origin to destination |
| **Map Bounds** | Auto-fits camera to show all markers | `LatLngBounds.Builder` with padding |
| **Status Timeline** | Visual step indicator: Confirmed -> Preparing -> Out for Delivery -> Delivered | Updates from API polling and Socket.IO events |
| **Socket.IO Connection** | `TrackingSocketManager` — listens for `driver:location` and `order:status` events | Real-time driver position updates |
| **Polling Fallback** | 15-second base interval with exponential backoff (max 2 minutes) | `consecutiveFailures` counter increases interval on errors |
| **Driver Info Card** | Driver name, phone number, vehicle details | Shown when order status is "assigned" or "out_for_delivery" |
| **ETA Display** | Minutes remaining + distance from driver to destination | Updated via Socket.IO + polling |
| **Call Driver** | Button opens phone dialer with driver's number | `ACTION_DIAL` intent |
| **Map Visibility** | Map card shown only when driver is assigned (status = "assigned" or "out_for_delivery") | Hidden during preparing/ready phases |
| **Rating Dialog** | Auto-triggers when status transitions to "delivered" | `RatingDialog` — separate ratings for restaurant (1-5 stars) and driver (1-5 stars) + optional comment. Shown once per session (`ratingDialogShown` flag) |
| **Back Navigation** | Returns to `CustomerActivity` | Standard back press |

### 4.6 Orders, Addresses & Profile

#### 4.6.1 Order History (`OrderHistoryActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Orders List | `RecyclerView` with `OrderHistoryAdapter` | Shows: order date, status badge (color-coded), item summary, total |
| Status Badges | Color-coded by status: pending (yellow), preparing (blue), delivered (green), cancelled (red) | Material chip styling |
| Tap Action | Opens `OrderTrackingActivity` for order detail/status | Re-uses tracking screen for historical view |
| Pagination | Paginated API response | Scroll to load more |

#### 4.6.2 Address Book (`AddressBookActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Saved Addresses List | `RecyclerView` with `AddressBookAdapter` | Shows: label, full address text, lat/lng stored |
| Add Address | Button opens `AddressPickerActivity` | Returns selected address |
| Edit / Delete | Swipe or tap actions on address items | Room database CRUD |
| Select for Order | Tappable address returns result to `CartActivity` | `startActivityForResult` pattern |

#### 4.6.3 Address Picker (`AddressPickerActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Google Places Autocomplete | Search bar with `AddressSuggestionAdapter` | Bounded to Zimbabwe coordinates for relevant results |
| Map with Draggable Pin | Google Map with centered, draggable marker | User can fine-tune location after search |
| Reverse Geocoding | Converts map pin coordinates to human-readable address | Updates address text as pin moves |
| Current Location Button | Gets device GPS and centers map | `FusedLocationProviderClient.getLastLocation()` |
| Confirm Button | Returns selected address (text, latitude, longitude) to calling activity | `setResult(RESULT_OK, intent)` |

#### 4.6.4 Referral Screen (`ReferralActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Referral Code Display | User's unique code in `ZF-XXXXXX` format | Prominently displayed, copy-to-clipboard action |
| Share Link | Share intent with referral URL | Android share sheet — WhatsApp, SMS, etc. |
| Available Credits | Number of unused referral credits | Each successful referral earns 1 credit |
| Used Credits | Number of credits already applied | Historical tracking |
| Discount Percentage | 15% discount per credit used | Displayed as benefit explanation |

#### 4.6.5 Settings (`SettingsActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Biometric Login Toggle | Switch to enable/disable biometric authentication | Stored in `EncryptedSharedPreferences` via `TokenManager` |
| WhatsApp Support | Button opens WhatsApp chat with ZimFeast support | `wa.me/263781603382` — direct support line |
| App Version | Displays current app version | Informational |

---

## 5. Driver App — Screen Specifications

### 5.1 Driver Onboarding

#### 5.1.1 Login (`LoginActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Email | EditText input | Required |
| Password | EditText input (masked) | Required |
| Login Button | Calls auth API, validates `role == "driver"` | Rejects non-driver accounts |
| Token Storage | Saves auth token via `ZimFeastDriverApp.getInstance()` | Application-level singleton storage |
| Post-Login | Fetches driver profile (name, vehicle, approval status) | Stores driver name for header display |
| Redirect | On success -> `MainActivity` | Clears LoginActivity from stack |

#### 5.1.2 Profile Setup

| Field | Details | Notes |
|-------|---------|-------|
| License Number | Driver's license ID | Required for approval |
| Vehicle Make | Vehicle manufacturer | Text input |
| Vehicle Model | Vehicle model name | Text input |
| License Plate | Registration plate number | Text input |
| Vehicle Color | Vehicle color description | Text input |
| ID Photo | Government ID photo upload | Camera capture or gallery |
| Vehicle Photo | Vehicle exterior photo | Camera capture or gallery |
| Approval Status | Admin must approve before driver can go online | `AdminPendingDriversPage` handles approval workflow |

### 5.2 Home Screen (`MainActivity`)

The driver home screen uses a `BottomNavigationView` with three tabs: **Home**, **Earnings**, and **Settings**. Each tab swaps content within the same activity using visibility toggles on `LinearLayout` and `ScrollView` containers.

#### 5.2.1 Home Tab

| Element | Details | Notes |
|---------|---------|-------|
| **Driver Name Header** | Displays driver's name from `ZimFeastDriverApp` singleton | `tv_driver_name` |
| **Header Rating** | Star rating badge in header area | `layout_header_rating` + `tv_header_rating`, fetched from driver profile API |
| **Online Toggle** | `SwitchMaterial` — large toggle at top | Emits `driver:go_online` / `driver:go_offline` via Socket.IO, starts/stops `LocationService` |
| **Status Text** | "Online — Waiting for orders" / "Offline" | `tv_status` updates with toggle state |
| **Offline Message** | Informational text when offline | `tv_offline_message` — hidden when online |
| **Delivery Offer Card** | Real-time Socket.IO delivery offers | `card_delivery_offer` — hidden by default, shown on incoming offer |
| Offer - Restaurant | Restaurant name and address | `tv_offer_restaurant`, `tv_offer_address` |
| Offer - Distance | Distance to restaurant + total delivery distance | `tv_offer_distance` |
| Offer - Earnings | Delivery fee + tip breakdown | `tv_offer_earnings` |
| Offer - Countdown | 30-second `CountDownTimer` with visual display | `tv_offer_timer` — `OFFER_TIMEOUT_SECONDS = 30` |
| Offer - Accept | Accepts delivery, navigates to `DeliveryActivity` | `btn_accept` — sends acceptance via Socket.IO + REST |
| Offer - Decline | Declines offer, returns to waiting state | `btn_decline` — hides offer card |
| **Network Monitor** | `NetworkUtils` LiveData observer | Shows `Snackbar.LENGTH_INDEFINITE` when offline with dismiss action |
| **Socket Connection** | `SocketManager` listener interface | `SocketListener` callbacks for offers, status updates, connection state |

#### 5.2.2 Earnings Tab

| Element | Details | Notes |
|---------|---------|-------|
| Total Earnings | Today's total earnings in USD | `tv_total_earnings` |
| Total Deliveries | Number of completed deliveries today | `tv_total_deliveries` |
| Total Distance | Kilometers driven today | `tv_total_distance` |
| Total Tips | Tips collected today | `tv_total_tips` |
| Hours Online | Total hours spent online today | `tv_hours_online` |
| Average Rating | Driver's average rating score | `tv_average_rating` |
| Recent Reviews | List of recent customer reviews | `layout_recent_reviews` container, `tv_no_reviews` placeholder |
| View History Button | Opens `OrderHistoryActivity` | `btn_view_history` |

Data source: `GET /api/drivers/daily/finances/` — per-day aggregation endpoint.

#### 5.2.3 Settings Tab

| Element | Details | Notes |
|---------|---------|-------|
| Driver Name | Profile display name | `tv_settings_name` |
| Phone Number | Contact number | `tv_settings_phone` |
| Vehicle Info | Vehicle make/model/plate/color | `tv_settings_vehicle` |
| Connection Indicator | Green/red dot showing Socket.IO connection status | `view_connection_indicator` + `tv_connection_status` |
| Edit Profile | Opens dialog for updating vehicle details | `btn_edit_profile` — in-activity `AlertDialog` with `EditText` fields |
| WhatsApp Support | Opens WhatsApp chat with ZimFeast support | `btn_whatsapp_support` — `wa.me/263781603382` |
| Logout | Clears auth tokens, returns to `LoginActivity` | `btn_logout` — clears `ZimFeastDriverApp` session |

### 5.3 Active Delivery (`DeliveryActivity`)

The active delivery screen is the driver's primary workspace during a delivery. It provides in-app map navigation, status progression, customer contact, and proof-of-delivery capture.

#### 5.3.1 Layout Structure

| Element | Details | Notes |
|---------|---------|-------|
| Status Header | Current delivery phase text with gradient background | `tv_delivery_status` |
| In-App Map | Embedded `MapView` managed by `NavigationHelper` | Google Maps with route polyline, driver marker (blue), destination marker (green=pickup, red=dropoff) |
| ETA/Distance Overlay | Floating overlay on map showing real-time ETA and distance | `overlay_eta` container with `tv_eta` and `tv_distance`, updated by `NavigationHelper` from Google Directions API |
| Re-center Button | Floating button at bottom-right of map | `btn_recenter` — calls `navigationHelper.recenterMap()` to fit full route in view |
| Pickup/Dropoff Details | Step indicator showing restaurant name (pickup) and delivery address (dropoff) | `tv_restaurant` and `tv_dropoff` |
| Customer Info | Customer name with call button | `customerName` + `customerPhone` — phone dial intent |
| Earnings Card | Delivery fee + tip display | `deliveryFee` and `tip` values from intent extras, green accent styling |
| Navigate Button | Opens external Google Maps for turn-by-turn directions | `btn_navigate` — fallback for detailed navigation |
| Update Status Button | Primary action button — advances delivery to next phase | `btn_update_status` — text changes per phase |

#### 5.3.2 Delivery Status Progression

The delivery follows a strict 5-phase progression. Each status update is synced to the server via REST API and broadcast via Socket.IO.

| Phase | Status Code | Header Text | Button Text | Map Destination | Notes |
|-------|------------|-------------|-------------|----------------|-------|
| 1 | `driver_assigned` | "Navigate to Restaurant" | "Arrived at Restaurant" | Restaurant (green marker) | Initial state — driver heads to pickup |
| 2 | `arrived_restaurant` | "At Restaurant - Wait for pickup" | "Picked Up Order" | Restaurant (green marker) | Driver waiting for food preparation |
| 3 | `picked_up` | "Order Picked Up - Heading to Customer" | "Arrived at Destination" | Customer (red marker) | In transit — map switches to dropoff destination |
| 4 | `arrived_destination` | "At Destination - Deliver to Customer" | "Complete Delivery" | Customer (red marker) | At customer location — ready to hand off |
| 5 | `delivered` | "Delivery Complete!" | "Done" (disabled) | N/A | Triggers proof-of-delivery photo prompt, auto-finishes after 2 seconds |

#### 5.3.3 Navigation System

| Component | Details | Notes |
|-----------|---------|-------|
| `NavigationHelper` | Dedicated class managing Google Maps rendering | Handles MapView lifecycle, marker placement, polyline drawing, camera animation |
| Route Polyline | Drawn from driver position to current destination | Updates as destination changes (restaurant -> customer) |
| Directions API | Google Directions API for ETA and distance | Real-time updates as driver location changes |
| Location Updates | `FusedLocationProviderClient` with `LocationRequest` | `Priority.PRIORITY_HIGH_ACCURACY`, updates fed to NavigationHelper and Socket.IO |
| External Navigation | Opens Google Maps app with destination coordinates | Fallback for drivers who prefer full turn-by-turn |

#### 5.3.4 Proof of Delivery

| Element | Details | Notes |
|---------|---------|-------|
| Photo Prompt | `AlertDialog` asking driver to take delivery photo | Triggered when advancing to "delivered" status |
| Camera Launch | `ActivityResultContracts.TakePicture` launcher | `FileProvider` for secure camera file URI |
| Camera Permission | `ActivityResultContracts.RequestPermission` for `CAMERA` | Falls back to completing without photo if denied |
| Photo Upload | `MultipartBody.Part` upload via Retrofit | `okhttp3.MediaType` image/jpeg, `RequestBody` from file |
| Skip Option | If photo capture cancelled or fails, delivery completes without photo | `completeDeliveryStatus()` called on skip |
| File Storage | Temporary JPEG in app's external files directory | `SimpleDateFormat` timestamp naming: `delivery_yyyyMMdd_HHmmss.jpg` |

#### 5.3.5 Location Service Integration

| Action | Intent | Effect |
|--------|--------|--------|
| Delivery Accepted | `ACTION_DELIVERY_ACTIVE` sent to `LocationService` | Switches to 10-second GPS interval for frequent tracking |
| Delivery Completed | `ACTION_DELIVERY_IDLE` sent to `LocationService` | Switches to 60-second GPS interval for battery conservation |
| Status Updates | Socket.IO emission | `order:status_update` event with orderId and new status |
| Location Broadcast | Socket.IO emission from `LocationService` | `driver:location` event with lat/lng for customer tracking |

### 5.4 Background Services

#### 5.4.1 Location Service (`LocationService`)

| Attribute | Details |
|-----------|---------|
| Type | Android Foreground Service (`Service`) with persistent notification |
| Notification Channel | `ZimFeastDriverLocation` — low importance, always visible while active |
| Location Provider | `FusedLocationProviderClient` (Google Play Services) |
| Active Interval | 10,000ms (10 seconds) — during active delivery |
| Idle Interval | 60,000ms (60 seconds) — when online but no active delivery |
| Interval Switching | `ACTION_DELIVERY_ACTIVE` / `ACTION_DELIVERY_IDLE` intents from `DeliveryActivity` |
| Location Emission | Each location update emitted via `SocketManager` as `driver:location` event |
| Socket Listener | Implements `SocketManager.SocketListener` — receives delivery offers while running |
| Delivery Notifications | Delegates to `DeliveryNotificationService` for offer push notifications |
| Lifecycle | `START_STICKY` — restarts if killed by system |
| Notification | Shows "ZimFeast Driver — Tracking your location" with tap-to-open `MainActivity` |

#### 5.4.2 Delivery Notification Service (`DeliveryNotificationService`)

| Attribute | Details |
|-----------|---------|
| Purpose | Shows Android push notifications for incoming delivery offers |
| Trigger | Called from `LocationService` when Socket.IO delivers a new offer event |
| Notification Content | Restaurant name, estimated earnings, distance |
| Tap Action | Opens `MainActivity` to display full offer card with accept/decline |
| Channel | Separate high-importance notification channel for delivery alerts |

### 5.5 Earnings & History

#### 5.5.1 Daily Finance (Home Screen — Earnings Tab)

| Metric | Source | Display |
|--------|--------|---------|
| Total Deliveries | `GET /api/drivers/daily/finances/` | Integer count |
| Total Earnings | `GET /api/drivers/daily/finances/` | USD currency format |
| Total Tips | `GET /api/drivers/daily/finances/` | USD currency format |
| Total Distance | `GET /api/drivers/daily/finances/` | Kilometers |
| Hours Online | `GET /api/drivers/daily/finances/` | Hours and minutes |
| Average Rating | `GET /api/drivers/daily/finances/` | Star rating (X.X / 5.0) |
| Recent Reviews | `GET /api/drivers/daily/finances/` | Customer name, rating, comment text |

#### 5.5.2 Order History (`OrderHistoryActivity`)

| Element | Details | Notes |
|---------|---------|-------|
| Completed Deliveries List | `RecyclerView` with `OrderHistoryAdapter` | Shows: date, restaurant, customer area, earnings, status |
| Pagination | Paginated API response | Scroll-to-load-more pattern |
| Navigation | Accessible from Earnings tab "View History" button | `btn_view_history` in `MainActivity` |

---

## 6. Restaurant Dashboard — Screen Specifications

Web-based dashboard (React), also usable on tablet. Located at /restaurant route.

### 6.1 Authentication
- Restaurant user logs in via web login page
- JWT token stored in localStorage
- Redirects to dashboard if already authenticated

### 6.2 Dashboard Layout
- DashboardHeader: Restaurant name, open/closed toggle (calls POST /api/restaurants/toggle-open/)
- Tabbed interface with 4 tabs: Dashboard, Menu, Finance, Settings

### 6.3 Dashboard Tab (Live Orders)
StatsCards component showing:
- Today's Orders (count)
- Today's Revenue (USD)
- Average Rating (stars)
- Menu Items Count
- Average Order Value

LiveOrders component:
- Real-time order list via WebSocket (/ws/restaurants/{id}/dashboard/)
- Polling fallback every 10 seconds
- Sound alerts for new orders (Web Audio API - ascending C5/E5/G5 chime)
- Visual flash animation (amber pulse, 3 cycles, 0.67s each)
- Mute toggle button (persisted in localStorage)
- Filter tabs: All, Pending, Preparing, Ready (with counts)
- Order cards showing: order ID, items list, total, status badge, timestamp, delivery/collection method
- Action buttons: "Start Preparing" → "Mark Ready" → "Mark Collected" (for collection orders) / "Awaiting Delivery" (for delivery orders)
- Prep timer countdown for orders being prepared
- Print receipt button per order
- Pagination (Previous/Next 10)
- Highlighted orders (WebSocket new_order events get 5s orange highlight)
- Export functionality

### 6.4 Menu Management Tab
MenuManagement component:
- Table view: item name, price, availability toggle, prep time, category
- Add new menu item (dialog form with image upload, multipart/form-data)
- Edit existing items
- Delete items (confirmation dialog)
- Category management

### 6.5 Finance Tab
RestaurantFinance component:
- Today's revenue & order count
- Weekly/monthly trend charts
- Top performing items
- Payment method breakdown (pie chart)
- Earnings history with platform fee deductions
- Unsettled amounts for direct payment restaurants
- Restaurant debt tracking

### 6.6 Settings Tab
RestaurantSettings component:
- Restaurant name, description, cover image
- Cuisine types selection
- Minimum order price
- Opening hours configuration (supports 24h + overnight schedules, UTC+2)
- Address / location
- Open/closed manual override toggle

### 6.7 External API Integration
ExternalAPIDialog component:
- Register external menu API endpoint
- Configure webhook URLs for order notifications
- API key management
- Useful for chain restaurants with central menu systems

---

## 7. Admin Panel — Screen Specifications

For internal use by ZimFeast operations team. Web-based React SPA at /admin/* routes.

### 7.1 Navigation
Collapsible sidebar with sections:
- Main: Dashboard, Orders, Finance
- Management: Users, Restaurants, Drivers, Pending Drivers
- Marketing: Banners, Corporate, Promos
- System: Reviews, System Health, Settings

### 7.2 Admin Dashboard (AdminDashboardPage)
| Element | Details | Notes |
|---------|---------|-------|
| Live Order Stats | Active orders by status (pie chart), orders last hour, avg delivery time | Real-time via polling |
| Stuck Orders Alert | Orders pending longer than threshold | Actionable warning |
| Revenue Trend | Daily revenue area chart (last 30 days) | Recharts visualization |
| Status Breakdown | Orders by status bar chart | Visual distribution |
| Top Restaurants | Table: restaurant name, order count, revenue | Sortable |
| Recent Orders | Last 20 orders with status badges | Quick overview |
| User Counts | Total customers, restaurants, drivers, admins | Role breakdown |

### 7.3 Orders Management (AdminOrdersPage)
| Element | Details | Notes |
|---------|---------|-------|
| Search | Search by order ID | Instant filter |
| Status Filter | Filter by order status | Dropdown select |
| Orders Table | ID, restaurant, customer ID, status badge, fee, created date | Sortable columns |
| Pagination | 10/25/50 per page options | Configurable |
| Order Detail | Click to view full breakdown: items, quantities, customer, driver, payment, timeline | Separate detail page |
| Status Override | Admin can force status change on any order | Emergency control |
| Export | CSV/Excel export of filtered orders | ExportButton component |

### 7.4 User Management (AdminUsersPage)
| Element | Details | Notes |
|---------|---------|-------|
| Role Filter | Filter by: customer, restaurant, driver, admin | Tab/dropdown |
| Search | Search by email or name | Instant filter |
| Users Table | Email, name, role badge, active status, joined date | Paginated |
| Suspend User | Dialog with reason text field | Toggles is_active |
| Promote to Admin | Elevate user role | With confirmation |
| Export | CSV/Excel export | Filtered data |

### 7.5 Restaurant Management (AdminRestaurantsPage)
| Element | Details | Notes |
|---------|---------|-------|
| Search | Search by restaurant name | Instant filter |
| Restaurant Table | Name, owner, open/closed, avg rating, reviews count, created | Sortable |
| Suspend/Unsuspend | Toggle restaurant active status | With confirmation |
| Detail View | Full restaurant profile, menu, orders, earnings | Click to expand |

### 7.6 Driver Management (AdminDriversPage)
| Element | Details | Notes |
|---------|---------|-------|
| Search | Search drivers by name | Instant filter |
| Drivers Table | Name, phone, rating (stars), total deliveries, vehicle details | Sortable |
| Online Status | Real-time online/offline indicator | Color-coded |
| Detail View | Full driver profile, delivery history, ratings, earnings | Click to expand |

### 7.7 Pending Driver Approvals (AdminPendingDriversPage)
| Element | Details | Notes |
|---------|---------|-------|
| Pending List | Drivers awaiting approval: name, license, vehicle, submitted date | Queue view |
| Approve | One-click approval, driver can go online | POST /api/drivers/admin/{id}/approve/ |
| Reject | Reject with notes/reason | POST /api/drivers/admin/{id}/reject/ |

### 7.8 Financial Analytics (AdminFinancePage)
| Element | Details | Notes |
|---------|---------|-------|
| Revenue Summary | Total revenue, this month, this week, today | KPI cards |
| Revenue by Payment Method | Pie chart (Paynow/Voucher/Direct) | Visual breakdown |
| Daily Revenue Trend | Bar + area chart (30 days) | Recharts |
| Top Restaurants by Revenue | Ranked table | Sortable |
| Failed Payments | List of failed Paynow transactions | Actionable |
| Settlements | Track settlements to restaurants | Outstanding amounts |
| Refund Processing | Admin can process refunds (mark failed, restore voucher) | Manual override |

### 7.9 Promotional Management
| Page | Elements | Notes |
|------|----------|-------|
| Banners (AdminBannersPage) | Create/edit promotional banners with campaigns (free_delivery, discount, info, new_restaurant), targeting (all/new/returning users), scheduling, priority, image | Displayed in customer app carousel |
| Promo Codes (AdminPromosPage) | Create discount codes: percentage/fixed, min order amount, max uses, expiry date, active toggle | Validated at checkout |
| Corporate (AdminCorporatePage) | Manage corporate accounts, employee limits, spending caps | Multi-employee companies |

### 7.10 System & Reviews
| Page | Elements | Notes |
|------|----------|-------|
| Reviews (AdminReviewsPage) | All customer reviews feed | Moderation capability |
| System (AdminSystemPage) | Service health checks, performance metrics | Monitoring |
| Settings (AdminSettingsPage) | Platform fees, delivery zones, app configuration | Global settings |

---

## 8. Technical Specifications

### 8.1 Architecture Overview

ZimFeast uses a microservices architecture with 6 backend services behind an Nginx API gateway:

| Service | Port | Language | Framework | Database | Replicas | Memory |
|---------|------|----------|-----------|----------|----------|--------|
| Auth Service | 8001 | Python | Django 4.2 + DRF | zimfeast_auth | 2 | 512MB |
| Restaurant Service | 8002 | Python | Django 4.2 + DRF | zimfeast_restaurants | 2 | 512MB |
| Order Service | 8003 | Go | net/http + gorilla/mux | zimfeast_orders | 3 | 128MB |
| Driver Service | 8004 | Go | net/http + gorilla/mux | zimfeast_drivers | 2 | 128MB |
| Payment Service | 8005 | Python | Django 4.2 + DRF | zimfeast_payments | 2 | 512MB |
| Realtime Service | 3001 | Go | Socket.IO | Redis only | 2 | 256MB |
| API Gateway | 80 | - | Nginx | - | 1 | 128MB |

### 8.2 Platforms & Frameworks
| Layer | Technology |
|-------|-----------|
| Customer App (Mobile) | Java (Native Android), Min SDK 24, Target SDK 34 |
| Driver App (Mobile) | Java (Native Android), Min SDK 24, Target SDK 35 |
| Web Frontend | React 18 + TypeScript, Vite 5, Tailwind CSS 3.4, Radix UI / shadcn |
| Data Fetching | TanStack Query (React Query), Socket.IO client |
| Backend (Django) | Django 4.2, Django REST Framework, Gunicorn/Daphne |
| Backend (Go) | Go standard library, gorilla/mux, lib/pq |
| Database | PostgreSQL 16 (1 database per service, 5 total) |
| Cache / PubSub | Redis 7 (pub/sub for async events, streams for crash recovery) |
| Authentication | Stateless JWT (shared secret across all services, 14-day access, 30-day refresh) |
| API Gateway | Nginx (path-based routing to correct service) |
| Real-time | Socket.IO (driver tracking, order updates, delivery offers) |
| Maps | Google Maps API (Places, Directions, geocoding — frontend + mobile) |
| Payments | Paynow Zimbabwe (EcoCash, OneMoney, InnBucks) |
| Push Notifications | Firebase Cloud Messaging (planned) |
| Storage | AWS S3 (food photos, rider photos, delivery proof images) |
| CDN | AWS CloudFront (frontend assets + media) |
| Containerization | Docker + Docker Compose (production orchestration) |
| Cloud | AWS (af-south-1 Cape Town region) |

### 8.3 Inter-Service Communication
| Method | Description | Used For |
|--------|-------------|----------|
| REST (Django) | HTTP calls via shared/service_client.py with X-Service-Key header | Cross-service data fetching |
| REST (Go) | HTTP calls via go-shared/ with X-Service-Key header | Cross-service data fetching |
| Redis Pub/Sub | JSON events on named channels | Real-time order status, delivery creation |
| Redis Streams | Durable message streams with consumer groups | Crash recovery, guaranteed delivery |
| Socket.IO | WebSocket with 2 namespaces: /drivers, /customers | Live tracking, delivery offers, status updates |
| JWT Forwarding | User JWT passed between services for identity | User context in cross-service calls |

### 8.4 Database Schema Summary
| Database | Key Tables | Purpose |
|----------|-----------|---------|
| zimfeast_auth | CustomUser, Address, BlacklistedToken, CorporateAccount, CorporateEmployee | User identity, addresses, corporate accounts |
| zimfeast_restaurants | Restaurant, MenuItem, Branch, RestaurantChain, RestaurantEarning, RestaurantFinanceSummary, RestaurantDebt, RestaurantReview, Banner, RestaurantExternalAPI | Restaurant profiles, menus, finance, reviews, promotions |
| zimfeast_orders | orders_order, orders_orderitem | Order lifecycle, items, delivery tracking |
| zimfeast_drivers | drivers_driver, drivers_driverorderstatus, drivers_driverfinance, drivers_driverrating, drivers_driverreject | Driver profiles, assignments, earnings, ratings |
| zimfeast_payments | Payment, FeastVoucher, PromoCode, PromoUsage, ReferralCode, ReferralCredit, ReferralTracking | Payments, e-wallet, promotions, referrals |

### 8.5 Order Status State Machine
```
pending_payment → paid → preparing → ready → collected → assigned → out_for_delivery → delivered
                                                                                    ↗
scheduled → pending_payment                                              any → cancelled
```

### 8.6 Payment Methods
| Method | Flow | Notes |
|--------|------|-------|
| Paynow (Web) | Redirect to Paynow payment page in WebView/browser | EcoCash, OneMoney, InnBucks |
| Paynow (Mobile) | USSD push to customer's phone (provider-specific) | Requires phone number + provider selection |
| Voucher (FeastVoucher) | Deduct from e-wallet balance | Instant, no external gateway |
| Voucher + Paynow | Partial voucher deduction + Paynow top-up for remainder | Hybrid payment |
| Direct Payment | Customer pays restaurant's own Paynow account | Platform still takes commission |

### 8.7 Delivery Fee Calculation
- Rate: $0.35 per kilometer (Haversine distance)
- Minimum fee: $1.50
- Geographic validation: Must be within Zimbabwe bounds (lat -22.5 to -15.3, lng 25.2 to 33.1)

### 8.8 Performance Requirements
- App load time: Under 3 seconds on 4G connection
- Order placement to kitchen notification: Under 10 seconds (via Redis pub/sub + Socket.IO)
- Live tracking update interval: 10 seconds (active delivery), 60 seconds (idle)
- Socket.IO reconnection: Unlimited attempts, exponential backoff (1s → 30s), 50% jitter
- Polling fallback: 15s base with exponential backoff to 2 minutes max
- Mid-range Android support: Min SDK 24 (Android 7.0+)
- Offline handling: Network status detection, offline banner, graceful degradation

### 8.9 Security
| Feature | Implementation |
|---------|---------------|
| API Transport | HTTPS only (ACM certificates, TLS 1.2+) |
| Authentication | Stateless JWT with refresh token rotation (old tokens blacklisted) |
| Admin Bootstrap | ADMIN_SETUP_TOKEN required for first admin account creation |
| Token Storage (Mobile) | EncryptedSharedPreferences (AES256-GCM) on customer app |
| Biometric Auth | AndroidX BiometricPrompt (BIOMETRIC_STRONG) on customer app |
| Sensitive Fields | Fernet symmetric encryption for Paynow keys, API secrets |
| Service Auth | X-Service-Key header for inter-service communication |
| Rate Limiting | 100 req/min per IP on auth endpoints (Go), DRF throttling (Django) |
| WAF | AWS WAF v2 with managed rules (Common + Known Bad Inputs) + rate limiting (2000/5min/IP) |
| Network Isolation | RDS + Redis only accessible within VPC, no public endpoints |
| GPS Privacy | Driver GPS data only active when driver is online |

---

## 9. AWS Deployment Architecture

### 9.1 Infrastructure (Terraform-managed)
| Component | AWS Service | Specification |
|-----------|------------|---------------|
| Region | af-south-1 (Cape Town) | Closest to Zimbabwe for low latency |
| Networking | VPC 10.0.0.0/16 | 2 public + 2 private subnets, Internet Gateway |
| Compute | ECS Fargate | 6 microservices, auto-scaling (target: 70% CPU) |
| Database | RDS PostgreSQL 16.4 | db.t4g.micro (Phase 1), auto-scaling storage 20-100GB, 7-day backups |
| Cache | ElastiCache Redis 7.1 | cache.t3.micro, at-rest encryption |
| Load Balancer | Application Load Balancer | HTTPS listener, path-based routing, health checks |
| CDN | CloudFront | 2 distributions (frontend + media), SPA fallback, PriceClass_200 (Africa) |
| Storage | S3 | 2 buckets: frontend (static) + media (uploads), public access blocked |
| DNS | Route 53 | Root domain + www + media subdomains |
| SSL | ACM | Certificates in us-east-1 (CloudFront) + af-south-1 (ALB) |
| Security | WAF v2 | Regional (ALB) + CloudFront, managed rules + rate limiting |
| Registry | ECR | 6 repositories with lifecycle policy (keep last 10 images) |
| Monitoring | CloudWatch | Log groups per service, 30-day retention |
| IAM | Execution + Task roles | Least privilege: ECR pull, S3 media access, CloudWatch logs |

### 9.2 Scaling Strategy
| Phase | Orders/Day | Database | Estimated Cost |
|-------|-----------|----------|---------------|
| Phase 1 (MVP) | 0–500 | db.t4g.micro (free tier) | ~$110–130/month |
| Phase 2 | 500–2,000 | db.t4g.small + Multi-AZ | ~$150–250/month |
| Phase 3 | 2,000+ | db.t4g.medium or Aurora Serverless v2 | ~$300+/month |

### 9.3 CI/CD Pipeline (GitHub Actions)
| Workflow | Trigger | Steps |
|----------|---------|-------|
| deploy-services.yml | Push to main (backend/* changes) or manual | Change detection → Docker build → ECR push (SHA + latest tags) → Django migrations (ECS RunTask) → Force new ECS deployment (rolling, zero-downtime) |
| deploy-frontend.yml | Push to main (webapp/* changes) or manual | npm build → S3 sync (1yr cache for assets, no-cache for index.html) → CloudFront invalidation |

---

## 10. Deliverables & Current Implementation Status

### 10.1 What Is Built (MVP Complete)

| Deliverable | Status | Technology |
|------------|--------|-----------|
| Customer Android App | ✅ Built | Java (Native Android), 15 screens |
| Driver Android App | ✅ Built | Java (Native Android), 4 screens + background services |
| Customer Web App | ✅ Built | React 18 + TypeScript + Tailwind |
| Restaurant Dashboard (Web) | ✅ Built | React 18 + TypeScript + Tailwind |
| Admin Panel (Web) | ✅ Built | React 18 + TypeScript + Tailwind, 13+ pages |
| Corporate Dashboard (Web) | ✅ Built | React 18 + TypeScript |
| Auth Microservice | ✅ Built | Django 4.2 + DRF |
| Restaurant Microservice | ✅ Built | Django 4.2 + DRF |
| Order Microservice | ✅ Built | Go |
| Driver Microservice | ✅ Built | Go |
| Payment Microservice | ✅ Built | Django 4.2 + DRF |
| Realtime Microservice | ✅ Built | Go + Socket.IO |
| API Gateway | ✅ Built | Nginx |
| Docker Orchestration | ✅ Built | Docker Compose (319 lines) |
| AWS Infrastructure | ✅ Built | Terraform (12 files) |
| CI/CD Pipeline | ✅ Built | GitHub Actions (2 workflows) |
| Google Maps Integration | ✅ Built | Places, Directions, Geocoding |
| Paynow Integration | ✅ Built | EcoCash, OneMoney, InnBucks |
| Real-time Order Tracking | ✅ Built | Socket.IO + Redis pub/sub |
| In-App Navigation (Driver) | ✅ Built | Google Directions API + MapView |
| Sound Alerts (Restaurant) | ✅ Built | Web Audio API (C5/E5/G5 chime) |
| WhatsApp Support | ✅ Built | wa.me deep link (+263781603382) |
| Biometric Authentication | ✅ Built | AndroidX BiometricPrompt |
| Referral System | ✅ Built | ZF-XXXXXX codes, 15% credit |
| Promo Code System | ✅ Built | Percentage/fixed discounts |
| FeastVoucher E-Wallet | ✅ Built | Balance management + payment split |
| Corporate Accounts | ✅ Built | Multi-employee, spending limits |
| Scheduled Orders | ✅ Built | Background scheduler (30s check) |
| Driver Approval Workflow | ✅ Built | Admin approve/reject + notes |
| Proof of Delivery Photos | ✅ Built | Camera capture + multipart upload |
| Restaurant Finance Tracking | ✅ Built | Per-order earnings, commission, debts |
| Receipt Printing | ✅ Built | Browser print API |
| Data Export (Admin) | ✅ Built | CSV/Excel (SpreadsheetML) |
| Banner/Promotion System | ✅ Built | Scheduled campaigns, targeting |
| Chef Zim AI Recommendations | ✅ Built | AI-powered food suggestions (web) |
| Dark Mode | ✅ Built | Class-based toggle (web) |
| External Restaurant API | ✅ Built | Chain restaurant integration |

### 10.2 Phase 2 Roadmap
| Feature | Priority | Notes |
|---------|----------|-------|
| iOS Customer App | High | Native Swift or cross-platform |
| iOS Driver App | High | Native Swift or cross-platform |
| SMS OTP Verification | High | Africa's Talking or Twilio |
| Push Notifications | High | Firebase Cloud Messaging |
| Loyalty/Rewards Program | Medium | Points-based system |
| Multi-language Support | Medium | Shona, Ndebele translations |
| ZiG Currency Display | Medium | Dual currency (USD + ZiG) |
| Advanced Analytics | Medium | Customer behavior, heatmaps |
| Customer Favorites/Saved | Low | Persistent restaurant bookmarks |
| Group Orders | Low | Shared cart feature |
| Driver Chat | Low | In-app messaging |

---

## 11. Timeline & Priorities

| Phase | Scope | Target |
|-------|-------|--------|
| Phase 1 (MVP) ✅ | Customer app + Driver app + Web apps + All 6 backend services + Docker + AWS infrastructure + CI/CD | Complete |
| Phase 2 | iOS apps, SMS OTP, push notifications, loyalty program, ZiG currency | Q2 2026 |
| Phase 3 | Multi-language, advanced analytics, group orders, driver chat, scheduled deliveries v2 | Q3 2026 |

| Priority | Detail |
|----------|--------|
| Primary Device | Android (majority of Zimbabwe smartphone users) |
| Internet Conditions | Must work on standard Zimbabwean mobile data (Econet, NetOne, Telecel) |
| Language | English only (MVP) |
| Currency | USD primary, ZiG dual display planned |
| Region | AWS af-south-1 (Cape Town) for low-latency Zimbabwe access |

---

## 12. Contact & Project Owner

| Field | Detail |
|-------|--------|
| Platform | ZimFeast — Food Delivery Marketplace |
| Company | Tishanyq Digital |
| Location | Harare, Zimbabwe |
| Support WhatsApp | +263 78 160 3382 |
| Website | zimfeast.com |

---

*This document is confidential and intended for contracted designers, developers, and investors only. Do not distribute.*

*This document is the intellectual property of Tishanyq Digital. Unauthorized reproduction or distribution is prohibited.*

**Document Version**: 1.0
**Last Updated**: March 2026
**Author**: Tishanyq Digital Engineering Team
