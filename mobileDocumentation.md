# Mobile Documentation

This document covers the Android mobile app in `customer-app/` and how new engineers should work on it.

## 1. Scope

Current mobile code in this repo is a **native Android customer app** (Java).

- Package: `com.zimfeast.customer`
- Platform: Android (min SDK 24, target SDK 34)
- Build system: Gradle (Android Studio project)

There is no separate Android driver app module in this repository.

## 2. Project Layout

```text
customer-app/
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/zimfeast/customer/
│       │   ├── data/api/          # Retrofit client and API interface
│       │   ├── data/local/        # Room DAOs and local database
│       │   ├── data/model/        # DTO/domain models
│       │   ├── socket/            # Socket.IO tracking manager
│       │   ├── ui/                # Activities and adapters
│       │   └── util/              # Helpers (token, biometrics, delivery utils)
│       └── res/                   # Layouts, drawables, strings, themes
├── build.gradle
└── settings.gradle
```

## 3. Runtime Architecture

### App bootstrap

- `ZimFeastApplication` initializes `ApiClient` on app startup.

### Network layer

- `ApiClient` uses Retrofit + OkHttp.
- Bearer token is attached from `TokenManager` on every request.
- `Content-Type: application/json` is set by interceptor.

### Local persistence

- Room DB persists cart/address state (`data/local/*`).

### Realtime tracking

- `socket/TrackingSocketManager` connects to `/customers` Socket.IO namespace.
- Handles events like `order:status`, `driver:location`, `order:eta`, `order:completed`.

## 4. Build Variants and Backend URLs

Configured in `app/build.gradle`:

- `debug`
  - `BASE_URL = "http://10.0.2.2/"`
  - `SOCKET_URL = "http://10.0.2.2"`
- `release`
  - `BASE_URL = "https://zimfeast.com/"`
  - `SOCKET_URL = "https://zimfeast.com"`

`10.0.2.2` maps Android emulator -> host machine localhost.

## 5. Manifest and Screens

`AndroidManifest.xml` declares internet/network/location permissions and these key activities:

- Splash (`SplashActivity`) - launcher
- Landing (`LandingActivity`)
- Auth (`LoginActivity`, `RegisterActivity`)
- Customer browse (`CustomerActivity`)
- Menu (`MenuActivity`)
- Cart (`CartActivity`)
- Checkout (`CheckoutActivity`, `PayNowWebViewActivity`)
- Tracking (`OrderTrackingActivity`)
- History (`OrderHistoryActivity`)
- Address flow (`AddressPickerActivity`, `AddressBookActivity`)
- Referral (`ReferralActivity`)

## 6. API Surface Used by Mobile

Defined in `data/api/ApiService.java`.

Main groups:

- Auth: login/register/profile
- Restaurants: nearby/list/menu/payment-info/reviews
- Orders: create/get/status/history
- Payments: create payment, voucher balance, promo validate, referral data
- Address book CRUD

Important note:

- Some API methods reference routes that may not exist in the current backend implementation (for example `/api/orders/my-orders/` and `/api/drivers/rate/driver/`). Validate backend parity before new feature work.

## 7. Local Setup for New Engineers

## 7.1 Prerequisites

- Android Studio (latest stable)
- Android SDK 34
- Java 17
- Running backend stack (recommended via `backend/docker-compose.yml`)

## 7.2 Run

1. Open `customer-app` in Android Studio.
2. Sync Gradle.
3. Start backend locally.
4. Run app on emulator/device.

For emulator + local backend:

- Keep debug `BASE_URL`/`SOCKET_URL` as `10.0.2.2`.

For physical device testing:

- Use machine LAN IP or hosted domain instead of `10.0.2.2`.

## 8. Common Development Tasks

### Add a new API endpoint

1. Add Retrofit method in `ApiService`.
2. Add model(s) under `data/model` if needed.
3. Call from relevant Activity/Adapter.
4. Handle auth and errors consistently.

### Add a new screen

1. Create Activity under `ui/<feature>/`.
2. Create layout XML under `res/layout/`.
3. Register activity in `AndroidManifest.xml`.
4. Wire navigation intents from existing screen.

### Add realtime behavior

1. Add event handler in `TrackingSocketManager`.
2. Extend `TrackingListener` interface if UI callback is needed.
3. Update consuming activity.

## 9. Security and Config Risks

- Google Maps API key is currently present in `AndroidManifest.xml`. Move to safer secret management before broad distribution.
- `usesCleartextTraffic="true"` is enabled; ensure production hardening.
- Ensure release keystore/signing workflow is managed outside source control.

## 10. Known Constraints

- No Gradle wrapper scripts (`./gradlew`) are currently present in repo root for this module workflow; Android Studio is the primary execution path.
- Mobile and backend API contracts are not fully synchronized in all routes; verify before major refactors.

## 11. First Week Mobile Onboarding Checklist

1. Build and run on emulator.
2. Complete login -> browse -> cart -> checkout -> tracking flow manually.
3. Inspect `ApiClient`, `ApiService`, and `TrackingSocketManager` end-to-end.
4. Verify each mobile API route against backend implementation.
5. Submit one small UI fix and one small API integration improvement.
