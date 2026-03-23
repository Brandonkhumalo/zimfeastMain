# ZIMFEAST

**Food Delivery Platform**
**Taste the Extraordinary**

---

**PRODUCT SPECIFICATION & FEATURE OVERVIEW**
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
8. [Platform Capabilities](#8-platform-capabilities)
9. [Deliverables & Implementation Status](#9-deliverables--implementation-status)
10. [Timeline & Priorities](#10-timeline--priorities)
11. [Contact & Project Owner](#11-contact--project-owner)

---

## 1. Project Overview

### 1.1 Platform Summary

| Field | Detail |
|-------|--------|
| Platform Name | ZimFeast |
| Tagline | Taste the Extraordinary |
| Business Type | Three-sided food delivery marketplace |
| Target Market | Zimbabwe — nationwide rollout, starting with Harare |
| Client / Owner | Tishanyq Digital, Harare, Zimbabwe |
| Currency | USD (primary), ZiG (Zimbabwe Gold) support planned |
| Payment Gateway | Paynow — Zimbabwe-specific (EcoCash, OneMoney, InnBucks) |
| Primary Brand Colors | #F97316 (Orange), #EA580C (Dark Orange), #FFFFFF (White) |
| Platform Type | Web App + Android Customer App + Android Driver App + Restaurant Dashboard + Admin Panel |

### 1.2 Platform Description

ZimFeast is a food delivery marketplace that connects three primary user types within the Zimbabwean market:

- **Customers** — Browse restaurant menus, place orders, pay via mobile money, track delivery in real time
- **Restaurants** — Receive and manage incoming orders, update menus, track finance and earnings
- **Drivers (Riders)** — Accept delivery jobs, navigate to pickup and drop-off with in-app navigation, track earnings

Additional user types:

- **Admins** — Full platform management, analytics, financial oversight, user moderation
- **Corporate Admins** — Multi-employee company accounts with departmental spending limits

The platform is designed for Zimbabwean internet conditions (Econet, NetOne, Telecel mobile data), optimized for mid-range Android devices, and uses Paynow — Zimbabwe's dominant payment gateway — supporting EcoCash, OneMoney, and InnBucks.

### 1.3 Key Differentiators

| Feature | Description |
|---------|-------------|
| Zimbabwe-First Payments | Native Paynow integration (EcoCash, OneMoney, InnBucks) — no international card required |
| FeastVoucher E-Wallet | Built-in digital wallet for instant payments and split-pay |
| AI Food Recommendations | "Chef Zim" AI assistant suggests dishes based on preferences |
| Corporate Accounts | Companies can create employee accounts with spending limits |
| Referral Program | Users earn 15% discount credits for referring new customers |
| Scheduled Orders | Customers can schedule deliveries for a future date and time |
| Proof of Delivery | Drivers photograph delivery as proof — visible to customer and admin |
| WhatsApp Support | Direct WhatsApp integration for customer support (+263 78 160 3382) |
| In-App Navigation | Drivers get turn-by-turn directions without leaving the app |
| Sound Alerts | Restaurant dashboard plays audio chimes for new incoming orders |
| Promotional Banners | Admin-managed campaigns targeting new, returning, or all users |
| Promo Code System | Percentage or fixed-amount discount codes with expiry and usage limits |
| Multi-Restaurant Support | Customers can browse and order from any registered restaurant |
| Dual Payment Modes | Restaurants can accept payments directly or through the platform |

---

## 2. Brand Identity & Design Guidelines

### 2.1 Color Palette

| Color | Hex Code | Usage |
|-------|----------|-------|
| Primary Orange | #F97316 | Main CTA buttons, highlights, active states, gradients |
| Dark Orange | #EA580C | Hover states, pressed states, gradient end |
| Deep Orange | #C2410C | Strong accents, gradient variant |
| Secondary Orange | #FB923C | Secondary accents, lighter highlights |
| Light Orange | #FDBA74 | Subtle backgrounds, secondary variants |
| Background | #F9FAFB | Main screen backgrounds |
| Surface | #FFFFFF | Cards, modals, panels |
| Dark Text | #1F2937 | Headings and body text |
| Secondary Text | #6B7280 | Subtext, captions |
| Tertiary Text | #9CA3AF | Placeholders, hints |
| Divider | #E5E7EB | Card borders, dividers |
| Error / Alert | #EF4444 | Errors, cancellations, warnings |
| Success | #22C55E | Order confirmed, delivered, online status |
| Warning | #F59E0B | Pending states, attention needed |
| Rating Star | #FBBF24 | Star ratings |
| Link Blue | #2563EB | Clickable links |

### 2.2 Typography

| Usage | Font | Weight | Notes |
|-------|------|--------|-------|
| Primary (Web) | Plus Jakarta Sans | 200–800 | All headings and body text |
| Secondary (Web) | Inter, DM Sans | 400–700 | Alternative body text |
| Primary (Mobile) | System sans-serif | All | Material Design 3 type scale |
| All text | — | — | Legible at small mobile sizes, clean and modern |

### 2.3 Icons & Imagery

- **Web icons**: Lucide React (outlined, consistent) + Font Awesome 6.5
- **Mobile icons**: Material Design 3, vector drawables
- **Food photography**: Bright, high-contrast, appetizing — no dark moody shots
- **Driver imagery**: Dynamic, movement-focused
- **UI style**: Glass morphism effects, orange gradients, rounded corners (24dp cards)
- **Animations**: Float animations, shimmer loading states, pulse effects

### 2.4 Overall UI Tone

- **Clean and premium** — orange feels warm, energetic, not cheap
- **Glass morphism** effects for depth and modernity
- **Dark mode** support on web and mobile (toggle-based)
- **Mobile-first** responsive design (sm / md / lg breakpoints)
- **Material Design 3** on Android with custom orange theme
- **Minimal clutter** — only what's needed on each screen
- **Fast and energetic** — users should feel like things are moving

---

## 3. User Types & Apps

ZimFeast has five separate interfaces — each optimized for its user:

### 3.1 Customer App (Android)

The main consumer-facing mobile app. Used to browse restaurants, order food, pay via mobile money, and track delivery in real time.

- 15 screens
- Biometric authentication (fingerprint / face)
- Offline cart and address persistence
- Real-time order tracking with live driver location
- Google Maps integration for address selection
- Paynow payment gateway (EcoCash, OneMoney, InnBucks)

### 3.2 Customer Web App (Browser)

Web-based customer experience accessible from any browser, with same features as mobile plus:

- AI-powered "Chef Zim" food recommendations
- Banner carousel for promotions
- Referral system with sharing
- WhatsApp support integration
- Dark mode toggle

### 3.3 Driver App (Android)

Used by delivery drivers to receive job notifications, navigate to pickup and drop-off, and track earnings.

- 4 main screens + background location service
- Real-time delivery offers with countdown timer
- In-app turn-by-turn navigation (Google Directions)
- Proof of delivery photo upload
- Daily earnings, tips, and rating summary
- Online/offline toggle with adaptive location tracking

### 3.4 Restaurant Dashboard (Web)

Web-based dashboard for restaurant staff to receive orders, manage menus, and track finance. Also usable on a tablet mounted in the kitchen.

- Tabbed interface: Dashboard, Menu, Finance, Settings
- Real-time order notifications with sound alerts and visual flash
- Mute toggle for sound alerts (persisted)
- Receipt printing
- Prep timer countdown per order
- Menu item management with image upload
- External API integration for chain restaurants

### 3.5 Admin Panel (Web)

Full platform management for ZimFeast operations team.

- 13+ dedicated management pages with sidebar navigation
- Real-time analytics with interactive charts
- User, restaurant, driver, and order management
- Financial analytics and settlement tracking
- Promotional banner and promo code management
- Driver approval workflow
- Data export (CSV / Excel)

---

## 4. Customer App — Screen Specifications

### 4.1 Onboarding & Authentication

| Screen | Key Elements | Notes |
|--------|-------------|-------|
| Splash Screen | ZimFeast logo centered, authentication check, biometric prompt | Auto-routes to Landing or Home based on login state |
| Landing Screen | Auto-scrolling cuisine carousel (10 cuisine types), curated restaurant showcase (5 featured), feature highlights (Speed, Security, Premium Selection), "Get Started" + "Login" buttons | Shown when logged out |
| Sign Up | First name, last name, email, phone number, password, role selector (Customer / Restaurant / Driver), optional referral code field | Biometric setup prompt after successful registration |
| Login | Email + password | Biometric login available on return visits |
| Location Permission | System prompt for location access | Required for delivery fee calculation and nearby restaurant sorting |

### 4.2 Home Screen

| Element | Details | Notes |
|---------|---------|-------|
| Navigation Drawer | User info (name, email), Orders, Favorites, Referrals, Help, Settings, Logout | Slide-out side menu |
| Cuisine Filters | Horizontal scrollable row: All, Fast Food, Traditional, Breakfast, Pizza, Chinese, Indian, Lunch Pack | Filters restaurant list by cuisine type |
| All Restaurants | Grid layout (2 columns), paginated, searchable by name | Shows: image, name, rating stars, cuisine tags, distance |
| Top Rated Section | Horizontal scroll cards, restaurants with rating >= 4.5 | Premium showcase |
| Nearby Section | Horizontal scroll, sorted by distance from user | Requires location permission |
| Chef Zim AI Card | Promotional card for AI food recommendations | Opens AI recommendation dialog |
| Cart Badge | Floating button showing item count | Persistent across screens |

### 4.3 Restaurant / Menu Screen

| Element | Details | Notes |
|---------|---------|-------|
| Restaurant Header | Cover image, restaurant name, cuisine type, star rating, estimated delivery time | Full-width hero section |
| Menu Items | Vertical scrollable list: item name, description, price, image thumbnail, "Add to Cart" button | Grouped by category |
| Cart Button | Floating badge showing total items currently in cart | Anchored at bottom of screen |

### 4.4 Cart & Checkout

| Screen | Key Elements | Notes |
|--------|-------------|-------|
| Cart Screen | Items list with quantity controls (increase / decrease / remove), order type toggle (Delivery vs Pickup), delivery address entry (manual, Google Places autocomplete, or saved addresses), delivery fee calculation (distance-based), tip input field, schedule order button (date + time picker for future orders) | Cart persists across app sessions |
| Checkout Screen | Order summary (items, subtotal, delivery fee, tip, total), payment method selection (PayNow Web / PayNow Mobile / Voucher), promo code entry and validation, referral credit usage option (15% discount), voucher balance display | Supports combined voucher + Paynow payment |
| PayNow Payment | Embedded payment page supporting EcoCash, OneMoney, InnBucks mobile money providers | Handles completion and cancellation |
| Order Placed | Animated confirmation with order number, redirects to tracking screen | Success state |

### 4.5 Live Order Tracking

| Element | Details | Notes |
|---------|---------|-------|
| Live Map | Google Map with 3 markers: Green (restaurant), Red (delivery address), Blue (driver — live position) | Real-time position updates |
| Route Line | Visual path drawn from restaurant to delivery address | Google Maps route |
| Status Timeline | Visual steps: Confirmed → Preparing → Out for Delivery → Delivered | Progress indicator with active/completed states |
| Driver Info Card | Driver name, phone number, vehicle details | Shown once driver is assigned |
| ETA Display | Estimated minutes remaining + distance in km | Updates automatically as driver moves |
| Call Driver | Direct phone dial button | One-tap calling |
| Rating Dialog | Auto-appears on delivery completion — rate restaurant (1–5 stars + comment) and driver (1–5 stars + comment) separately | Encourages feedback |

### 4.6 Orders & Profile

| Screen | Key Elements | Notes |
|--------|-------------|-------|
| Order History | List of all past orders: status badge, date, restaurant name, total amount | Tap to view full tracking details |
| Address Book | Saved delivery addresses with label (Home, Work, etc.), full text, map coordinates | Add, edit, delete addresses |
| Address Picker | Google Places autocomplete (bounded to Zimbabwe), interactive map with draggable pin, reverse geocoding, "Use Current Location" button | Returns selected address to Cart |
| Referral Screen | Unique referral code (ZF-XXXXXX), shareable link, list of available and used referral credits, discount percentage | Share via any messaging app |
| Settings | Biometric login enable/disable, WhatsApp support button (opens chat with +263 78 160 3382) | Security and help |

---

## 5. Driver App — Screen Specifications

### 5.1 Authentication & Onboarding

| Screen | Key Elements | Notes |
|--------|-------------|-------|
| Login | Email + password, validates driver role | Routes to home screen on success |
| Profile Setup | License number, vehicle details (make, model, plate number, color), ID photo upload, vehicle photo upload | Submitted for admin review — driver cannot go online until approved |

### 5.2 Home Screen

| Element | Details | Notes |
|---------|---------|-------|
| Delivery Offers Section | Real-time incoming delivery offers. Each offer shows: restaurant name and address, drop-off address, distances (to restaurant, to customer, total route), earnings breakdown (delivery fee + tip), countdown timer. Accept / Reject buttons | 30-second timer per offer — auto-declines if no response |
| Accepted Deliveries | Horizontal scrollable cards of currently active deliveries with status progression | Quick navigation to active delivery screen |
| Daily Finance Card | Today's deliveries count, total earnings ($), tips collected ($), hours online, average rating (stars) | At-a-glance daily performance |
| Online / Offline Toggle | Large prominent toggle button | Going online starts background location tracking; going offline stops it |
| Location Service Indicator | Shows whether background location tracking is active | Visual confirmation for driver |

### 5.3 Active Delivery Screen

The core delivery execution screen. Guides the driver through a 5-phase delivery process:

| Phase | Status Display | Action Button | Notes |
|-------|---------------|--------------|-------|
| Phase 1 | "Navigate to Restaurant" | "Arrived at Restaurant" | Driver heading to pick up the order |
| Phase 2 | "At Restaurant — Wait for Pickup" | "Picked Up Order" | Driver is at restaurant, waiting for food |
| Phase 3 | "Order Picked Up — Heading to Customer" | "Arrived at Destination" | Driver en route to customer |
| Phase 4 | "At Destination — Deliver to Customer" | "Complete Delivery" | Triggers proof of delivery photo prompt |
| Phase 5 | "Delivery Complete!" | Done (auto-returns to home after 2 seconds) | Delivery finished |

| Element | Details | Notes |
|---------|---------|-------|
| Embedded Map | Full Google Map with driver's live position, route polyline to destination, destination marker (green for pickup, red for drop-off) | In-app turn-by-turn navigation with Google Directions |
| ETA / Distance Overlay | Real-time estimated arrival time and distance remaining | Updates as driver moves |
| Re-center Button | Re-fits map to show full route between driver and destination | Floating button on map |
| Pickup & Drop-off Info | Step indicator showing restaurant name (pickup) and delivery address (drop-off) | Visual progress bar |
| Customer Info Card | Customer name with one-tap call button | Direct phone dial |
| Earnings Display | Delivery fee and tip amount for this order | Green accent card |
| Navigate Button | Opens external Google Maps for full turn-by-turn if needed | Fallback option |
| Proof of Delivery | Camera prompt when completing final delivery step — photo uploaded as delivery proof | Optional — driver can skip |

### 5.4 Background Services

| Service | Behavior | Notes |
|---------|----------|-------|
| Location Tracking | Runs continuously while driver is online. Adaptive intervals: every 10 seconds during active delivery, every 60 seconds when idle/waiting for orders | Foreground service with persistent notification |
| Delivery Notifications | Push-style notifications for new delivery offers when app is backgrounded | Brings driver's attention to new jobs |

### 5.5 Earnings & History

| Screen | Key Elements | Notes |
|--------|-------------|-------|
| Daily Finance | Deliveries completed, total earnings, tips, hours online, average rating — displayed on home screen | Per-day summary |
| Order History | List of completed deliveries with date, restaurant, customer area, earnings, status | Scrollable with pagination |

---

## 6. Restaurant Dashboard — Screen Specifications

Web-based dashboard, also usable on a tablet mounted in the kitchen or front of house.

### 6.1 Authentication

- Restaurant owner/staff logs in via web
- Automatic redirect to dashboard if already authenticated

### 6.2 Dashboard Layout

- **Header**: Restaurant name display + Open/Closed toggle switch (controls whether restaurant appears to customers)
- **Tabbed Interface**: Four main tabs — Dashboard, Menu, Finance, Settings

### 6.3 Dashboard Tab (Live Orders)

**Stats Cards** (top of dashboard):

| Metric | Display |
|--------|---------|
| Today's Orders | Count |
| Today's Revenue | USD amount |
| Average Rating | Star rating |
| Menu Items | Total count |
| Average Order Value | USD amount |

**Live Orders Panel**:

| Feature | Details | Notes |
|---------|---------|-------|
| Real-time Order List | Orders appear instantly as they are placed | WebSocket-powered live updates |
| Sound Alerts | Ascending chime plays when new order arrives | Pleasant 3-note tone (C5 → E5 → G5) |
| Visual Flash | New order card flashes amber 3 times (0.67s each), glowing border | Draws attention to new orders |
| Mute Toggle | Button to mute/unmute sound alerts | Preference saved across sessions |
| Status Filters | Filter tabs: All, Pending, Preparing, Ready — each showing count | Quick status overview |
| Order Cards | Order ID, items list with quantities, total amount, status badge, timestamp, delivery/collection method indicator | Full order info at a glance |
| Action Buttons | "Start Preparing" → "Mark Ready" → "Mark Collected" (collection) / "Awaiting Delivery" (delivery) | Sequential status progression |
| Prep Timer | Countdown timer showing elapsed preparation time per order | Visible on orders being prepared |
| Print Receipt | Print button per order | Opens browser print dialog |
| Pagination | Previous / Next buttons (10 orders per page) | Navigate through order history |
| Highlighted Orders | Newly arrived orders get 5-second orange highlight animation | Visual priority for new orders |

### 6.4 Menu Management Tab

| Feature | Details | Notes |
|---------|---------|-------|
| Menu Table | All items displayed: name, price, availability toggle, prep time, category | Full inventory view |
| Add New Item | Dialog form: item name, description, price, category, prep time, image upload | Supports photo upload |
| Edit Item | Modify any field of existing menu items | Inline or dialog editing |
| Delete Item | Remove item with confirmation dialog | Prevents accidental deletion |
| Availability Toggle | Quick on/off switch per item (e.g. "Sold Out" for the day) | Instant visibility control |
| Category Management | Create and assign food categories to items | Organize menu structure |

### 6.5 Finance Tab

| Feature | Details | Notes |
|---------|---------|-------|
| Today's Revenue | Revenue and order count for current day | Daily snapshot |
| Trend Charts | Weekly and monthly revenue trend lines | Visual performance tracking |
| Top Items | Best-performing menu items by sales | Identify popular dishes |
| Payment Breakdown | Pie chart showing payment methods used by customers | Revenue source analysis |
| Earnings History | Per-order earnings with platform fee deductions | Detailed financial log |
| Outstanding Amounts | Unsettled balances for direct-payment restaurants | Track what's owed |

### 6.6 Settings Tab

| Feature | Details | Notes |
|---------|---------|-------|
| Restaurant Info | Name, description, cover image upload | Brand presentation |
| Cuisine Types | Select applicable cuisine categories | Helps customer discovery |
| Minimum Order | Set minimum order value for delivery | Business rule |
| Opening Hours | Configure daily operating hours (supports 24h and overnight schedules) | Controls when restaurant is visible |
| Location | Restaurant address and map pin | Delivery distance calculations |
| Open/Closed Override | Manual toggle to go offline regardless of schedule | Emergency or ad-hoc closure |

### 6.7 External API Integration

| Feature | Details | Notes |
|---------|---------|-------|
| Menu API Endpoint | Register external menu management system URL | For chain restaurants with central menus |
| Order Webhook | Configure URL to receive order notifications externally | Third-party integration |
| API Key Management | Securely store and manage integration credentials | Encrypted storage |

---

## 7. Admin Panel — Screen Specifications

For internal use by ZimFeast management team. Web-based, accessible at /admin.

### 7.1 Navigation

Collapsible sidebar with organized sections:

- **Main**: Dashboard, Orders, Finance
- **Management**: Users, Restaurants, Drivers, Pending Driver Approvals
- **Marketing**: Banners, Corporate Accounts, Promo Codes
- **System**: Reviews, System Health, Settings

### 7.2 Admin Dashboard

| Element | Details | Notes |
|---------|---------|-------|
| Live Order Stats | Active orders by status (pie chart), orders placed in last hour, average delivery time | Real-time monitoring |
| Stuck Orders Alert | Flags orders that have been pending longer than expected | Actionable warning for ops team |
| Revenue Trend | Daily revenue chart (last 30 days) | Visual trend line |
| Status Breakdown | Orders by status (bar chart) | Distribution overview |
| Top Restaurants | Table ranking restaurants by order count and revenue | Performance leaderboard |
| Recent Orders | Last 20 orders with status badges | Quick activity feed |
| User Counts | Total customers, restaurants, drivers, admins | Platform size at a glance |

### 7.3 Orders Management

| Element | Details | Notes |
|---------|---------|-------|
| Search | Search by order ID | Instant filtering |
| Status Filter | Filter orders by status (all statuses available) | Dropdown selector |
| Orders Table | Order ID, restaurant name, customer, status badge, total fee, created date | Sortable columns |
| Pagination | 10 / 25 / 50 orders per page | Configurable page size |
| Order Detail | Click to view: full item breakdown, customer info, driver info, payment details, status timeline | Complete order audit |
| Status Override | Admin can force-change any order's status | Emergency intervention |
| Export | Download filtered orders as CSV or Excel | Reporting and analysis |

### 7.4 User Management

| Element | Details | Notes |
|---------|---------|-------|
| Role Filter | Filter by: Customer, Restaurant, Driver, Admin | Tab or dropdown |
| Search | Search by email or name | Instant filter |
| Users Table | Email, name, role badge, active/suspended status, join date | Paginated list |
| Suspend User | Dialog to suspend account with reason field | Toggles user access |
| Promote to Admin | Elevate user role to admin | With confirmation |
| Export | Download filtered users as CSV or Excel | CRM reporting |

### 7.5 Restaurant Management

| Element | Details | Notes |
|---------|---------|-------|
| Search | Search by restaurant name | Instant filter |
| Restaurant Table | Name, owner, open/closed status, average rating, reviews count, created date | Sortable columns |
| Suspend / Unsuspend | Toggle restaurant active status | With confirmation dialog |
| Detail View | Full restaurant profile, menu items, order history, earnings | Complete restaurant audit |

### 7.6 Driver Management

| Element | Details | Notes |
|---------|---------|-------|
| Search | Search drivers by name | Instant filter |
| Drivers Table | Name, phone, star rating, total deliveries, vehicle details | Sortable columns |
| Online Status | Real-time online/offline indicator | Color-coded badge |
| Detail View | Full driver profile, delivery history, ratings, earnings | Complete driver audit |

### 7.7 Pending Driver Approvals

| Element | Details | Notes |
|---------|---------|-------|
| Pending Queue | Drivers awaiting approval: name, license info, vehicle details, submission date | Queue view |
| Approve | One-click approval — driver can immediately go online | Instant activation |
| Reject | Reject with written reason/notes sent to driver | Feedback for resubmission |

### 7.8 Financial Analytics

| Element | Details | Notes |
|---------|---------|-------|
| Revenue Summary | Total revenue, this month, this week, today | KPI cards |
| Revenue by Payment Method | Pie chart (Paynow / Voucher / Direct) | Payment mix analysis |
| Daily Revenue Trend | Bar and area chart (30 days) | Visual trend |
| Top Restaurants by Revenue | Ranked table | Revenue leaders |
| Failed Payments | List of failed payment transactions | Troubleshooting |
| Settlements | Track payment settlements to restaurants | Outstanding balance tracking |
| Refund Processing | Admin can process customer refunds | Manual override capability |

### 7.9 Promotional Management

| Page | Key Elements | Notes |
|------|-------------|-------|
| Banners | Create/edit promotional banners: campaign type (free delivery, discount, info, new restaurant), targeting (all users / new users / returning users), scheduling (start/end dates), priority ranking, image upload | Displayed in customer app carousel |
| Promo Codes | Create discount codes: percentage or fixed amount, minimum order value, maximum uses, expiry date, active/inactive toggle | Applied at checkout by customers |
| Corporate Accounts | Manage corporate client accounts: company name, employee lists, per-employee spending limits, department budgets | B2B client management |

### 7.10 System & Reviews

| Page | Key Elements | Notes |
|------|-------------|-------|
| Reviews | All customer reviews feed with restaurant and driver ratings | Content moderation capability |
| System Health | Service status monitoring, performance indicators | Operational oversight |
| Platform Settings | Platform-wide fee configuration, delivery zone management, app behavior settings | Global configuration |

---

## 8. Platform Capabilities

### 8.1 Payment Methods

| Method | Description | Notes |
|--------|-------------|-------|
| Paynow (Web) | Customer redirected to Paynow payment page | EcoCash, OneMoney, InnBucks |
| Paynow (Mobile) | USSD push notification sent to customer's phone | Requires phone number and provider selection |
| FeastVoucher | Deduction from built-in e-wallet balance | Instant — no external gateway needed |
| Voucher + Paynow | Partial voucher deduction + Paynow for remainder | Hybrid split payment |
| Direct Restaurant Payment | Customer pays restaurant's own Paynow account | Platform commission still applied |

### 8.2 Order Flow

```
Customer places order → Payment processed → Restaurant notified (sound + visual alert)
→ Restaurant starts preparing → Order marked ready → Driver assigned
→ Driver picks up order → Driver navigates to customer (live tracking)
→ Driver delivers + takes proof photo → Order completed → Rating prompt shown
```

### 8.3 Order Statuses

```
Pending Payment → Paid → Preparing → Ready → Collected → Assigned → Out for Delivery → Delivered
```

Additional states: Scheduled (for future orders), Cancelled.

### 8.4 Delivery Fee

- Rate: $0.35 per kilometer (straight-line distance)
- Minimum fee: $1.50
- Delivery must be within Zimbabwe

### 8.5 Referral Program

- Each user gets a unique referral code (format: ZF-XXXXXX)
- New user registers with referral code → tracked
- After referred user places a qualifying order ($20+), referrer earns a 15% discount credit
- Credits are single-use, applied at checkout

### 8.6 Promo Codes

- Admin creates discount codes with: percentage or fixed discount, minimum order amount, maximum usage count, expiry date
- Customers enter code at checkout — validated and applied automatically
- One use per customer per promo code

### 8.7 FeastVoucher E-Wallet

- Built-in digital wallet per user
- Can be topped up via Paynow deposit
- Used for instant checkout (no external redirect)
- Can be combined with Paynow if balance is insufficient (auto top-up flow)

### 8.8 Scheduled Orders

- Customers can select a future date and time for delivery
- Order is held in "Scheduled" status
- System automatically transitions order to active when scheduled time arrives
- Restaurant receives notification at the appropriate time

### 8.9 Corporate Accounts

- Companies register a corporate account
- Corporate admin adds employees by email
- Per-employee spending limits configurable
- Account-level total spending cap
- Employees can order using corporate billing

### 8.10 Real-Time Features

| Feature | Description |
|---------|-------------|
| Live Order Tracking | Customers see driver's position on map updating in real time |
| Restaurant Order Alerts | New orders appear instantly with sound chime and visual flash |
| Driver Delivery Offers | Drivers receive delivery job offers in real time with countdown |
| ETA Updates | Estimated arrival time and distance update as driver moves |
| Driver Location Broadcast | Driver's GPS position shared with customer during delivery |

### 8.11 Performance Targets

| Metric | Target |
|--------|--------|
| App Load Time | Under 3 seconds on 4G |
| Order-to-Kitchen Notification | Under 10 seconds |
| Live Tracking Update | Every 10 seconds (active delivery) |
| Driver Location (Idle) | Every 60 seconds |
| Minimum Android Version | Android 7.0 (API 24) |
| Offline Handling | Graceful degradation — offline banner, cached cart and addresses |

### 8.12 Security Highlights

| Feature | Description |
|---------|-------------|
| Encrypted Token Storage | Authentication tokens encrypted on device (AES-256) |
| Biometric Authentication | Fingerprint / face login on customer app (optional) |
| Secure Payments | All payment data handled by Paynow gateway — never stored on device |
| Rate Limiting | Protection against brute-force attacks on login |
| Web Application Firewall | Protection against common web attacks and abusive traffic |
| HTTPS Only | All communication encrypted in transit |
| Driver GPS Privacy | Location tracking only active when driver is online |

---

## 9. Deliverables & Implementation Status

### 9.1 What Is Built (MVP Complete)

| Deliverable | Status |
|------------|--------|
| Customer Android App (15 screens) | ✅ Complete |
| Driver Android App (4 screens + background services) | ✅ Complete |
| Customer Web App | ✅ Complete |
| Restaurant Dashboard (Web) | ✅ Complete |
| Admin Panel (Web, 13+ pages) | ✅ Complete |
| Corporate Dashboard (Web) | ✅ Complete |
| Paynow Payment Integration (EcoCash, OneMoney, InnBucks) | ✅ Complete |
| FeastVoucher E-Wallet | ✅ Complete |
| Google Maps Integration (Places, Directions, Geocoding) | ✅ Complete |
| Real-Time Order Tracking (live driver location) | ✅ Complete |
| In-App Driver Navigation (turn-by-turn directions) | ✅ Complete |
| Sound Alerts for Restaurant Orders | ✅ Complete |
| WhatsApp Support Integration | ✅ Complete |
| Biometric Authentication (Customer App) | ✅ Complete |
| Referral Program (ZF-XXXXXX codes, 15% credit) | ✅ Complete |
| Promo Code System (percentage / fixed discounts) | ✅ Complete |
| Scheduled Orders (future date/time delivery) | ✅ Complete |
| Corporate Accounts (multi-employee, spending limits) | ✅ Complete |
| Driver Approval Workflow (admin approve/reject) | ✅ Complete |
| Proof of Delivery Photos | ✅ Complete |
| Restaurant Finance Tracking (earnings, commissions, debts) | ✅ Complete |
| Receipt Printing (Restaurant Dashboard) | ✅ Complete |
| Admin Data Export (CSV / Excel) | ✅ Complete |
| Promotional Banner System (campaigns, targeting, scheduling) | ✅ Complete |
| Chef Zim AI Food Recommendations (Web) | ✅ Complete |
| Dark Mode (Web) | ✅ Complete |
| External Restaurant API Integration | ✅ Complete |
| Cloud Infrastructure (AWS) | ✅ Complete |
| CI/CD Deployment Pipeline | ✅ Complete |
| Docker Containerization | ✅ Complete |

### 9.2 Phase 2 Roadmap

| Feature | Priority |
|---------|----------|
| iOS Customer App | High |
| iOS Driver App | High |
| SMS OTP Verification | High |
| Push Notifications (Firebase) | High |
| Loyalty / Rewards Program | Medium |
| Multi-Language Support (Shona, Ndebele) | Medium |
| ZiG Currency Dual Display | Medium |
| Advanced Analytics (customer behavior, heatmaps) | Medium |
| Customer Favorites / Saved Restaurants | Low |
| Group Orders (shared cart) | Low |
| In-App Driver Chat | Low |

---

## 10. Timeline & Priorities

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 (MVP) | Customer App + Driver App + Web Apps + Restaurant Dashboard + Admin Panel + Payments + Tracking + Cloud Infrastructure + CI/CD | ✅ Complete |
| Phase 2 | iOS apps, SMS OTP, push notifications, loyalty program, ZiG currency | Q2 2026 |
| Phase 3 | Multi-language, advanced analytics, group orders, driver chat | Q3 2026 |

| Priority | Detail |
|----------|--------|
| Primary Device | Android first (majority of Zimbabwe smartphone users) |
| Internet Conditions | Optimized for standard Zimbabwean mobile data (Econet, NetOne, Telecel) |
| Language | English only (MVP) |
| Currency | USD primary, ZiG dual display planned for Phase 2 |

---

## 11. Contact & Project Owner

| Field | Detail |
|-------|--------|
| Project Owner | Tishanyq Digital |
| Platform | ZimFeast — Food Delivery Marketplace |
| Location | Harare, Zimbabwe |
| Support WhatsApp | +263 78 160 3382 |
| Website | zimfeast.com |

---

*This document is confidential and intended for partners, investors, and contracted professionals only. Do not distribute.*

*ZimFeast is the intellectual property of Tishanyq Digital. Unauthorized reproduction or distribution is prohibited.*

**Document Version**: 1.0
**Last Updated**: March 2026
**Author**: Tishanyq Digital
