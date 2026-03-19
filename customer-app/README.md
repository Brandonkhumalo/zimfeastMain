# ZimFeast Android App

A native Android food delivery application for Zimbabwe, built with Java for Android Studio.

## Features

- **Landing Page** - App introduction with feature highlights
- **User Authentication** - Login and registration with role-based access (customer, restaurant, driver)
- **Restaurant Browsing** - View restaurants with search, cuisine filters, and location-based nearby search
- **Shopping Cart** - Add items, manage quantities, view totals with delivery fee calculation
- **Checkout** - Multiple payment methods:
  - PayNow Web (browser-based)
  - PayNow Mobile (EcoCash, OneMoney, InnBucks)
  - Feast Voucher
- **Order Tracking** - Real-time order status and driver information

## Project Structure

```
├── app/
│   ├── src/main/
│   │   ├── java/com/zimfeast/customer/
│   │   │   ├── data/
│   │   │   │   ├── api/        # Retrofit API client and services
│   │   │   │   ├── local/      # Room database
│   │   │   │   ├── model/      # Data models
│   │   │   │   └── repository/ # Data repositories
│   │   │   ├── ui/
│   │   │   │   ├── landing/    # Landing screen
│   │   │   │   ├── auth/       # Login/Register
│   │   │   │   ├── customer/   # Restaurant browsing
│   │   │   │   ├── cart/       # Shopping cart
│   │   │   │   ├── checkout/   # Payment processing
│   │   │   │   └── tracking/   # Order tracking
│   │   │   └── util/           # Utility classes
│   │   └── res/
│   │       ├── layout/         # XML layouts
│   │       ├── drawable/       # Icons and drawables
│   │       └── values/         # Strings, colors, themes
│   └── build.gradle
├── build.gradle
└── settings.gradle
```

## Dependencies

- **AndroidX AppCompat & Material** - UI components
- **Retrofit 2** - HTTP client for API calls
- **OkHttp** - HTTP client with logging
- **Gson** - JSON parsing
- **Room** - Local database for cart persistence
- **Glide** - Image loading
- **Google Play Services** - Location and Maps
- **Security Crypto** - Encrypted SharedPreferences for token storage

## Setup

1. Open this project in Android Studio
2. Sync Gradle files
3. Configure the backend API URL in `ApiClient.java`
4. (Optional) Add your Google Maps API key in `AndroidManifest.xml`
5. Build and run on an emulator or physical device

## Backend API

The app connects to a backend API at `http://192.168.1.9:8000/`. Update the `BASE_URL` in `ApiClient.java` to point to your backend server.

### API Endpoints Used

- `POST /api/accounts/login/` - User login
- `POST /api/accounts/register/` - User registration
- `GET /api/accounts/profile/` - Get user profile
- `GET /api/restaurants/` - List restaurants
- `POST /api/orders/` - Create order
- `GET /api/orders/order/{id}/` - Get order details
- `POST /api/payments/create/payment/` - Process payment
- `GET /api/payments/feast/voucher/balance/` - Get voucher balance

## Building

```bash
./gradlew assembleDebug
```

The APK will be generated at `app/build/outputs/apk/debug/app-debug.apk`

## License

Private - ZimFeast
