# ZimFeast Customer App

## Overview
ZimFeast is a food delivery mobile application for Zimbabwe. The app allows customers to browse restaurants, place orders, make payments, and track deliveries.

## Recent Changes
- **January 2026**: Complete migration from React Native/Expo to native Android Java
  - Created full Android Studio project structure
  - Implemented all screens: Landing, Login, Register, Customer browsing, Cart, Checkout, Order Tracking
  - Integrated Retrofit for API communication
  - Added Room database for local cart persistence
  - Implemented PayNow payment integration (web and mobile)
  - Deleted all React Native code

## Project Architecture

### Technology Stack
- **Language**: Java
- **Platform**: Native Android (Android Studio)
- **Min SDK**: 24 (Android 7.0)
- **Target SDK**: 34 (Android 14)

### Project Structure
```
├── app/src/main/
│   ├── java/com/zimfeast/customer/
│   │   ├── ZimFeastApplication.java     # Application class
│   │   ├── data/
│   │   │   ├── api/                     # Retrofit API client
│   │   │   ├── local/                   # Room database
│   │   │   └── model/                   # Data models
│   │   ├── ui/
│   │   │   ├── landing/                 # Landing screen
│   │   │   ├── auth/                    # Login/Register
│   │   │   ├── customer/                # Restaurant browsing
│   │   │   ├── cart/                    # Shopping cart
│   │   │   ├── checkout/                # Payment processing
│   │   │   └── tracking/                # Order tracking
│   │   └── util/                        # Utilities
│   └── res/                             # Resources (layouts, drawables, etc.)
├── build.gradle
└── settings.gradle
```

### Key Components

#### Data Layer
- **ApiClient.java**: Retrofit configuration with JWT interceptor
- **ApiService.java**: API endpoint definitions
- **TokenManager.java**: Secure token storage using EncryptedSharedPreferences
- **AppDatabase.java**: Room database for cart persistence
- **CartDao.java**: Data access object for cart operations

#### UI Layer
- **LandingActivity**: Welcome screen with app features
- **LoginActivity / RegisterActivity**: User authentication
- **CustomerActivity**: Main screen with restaurant browsing, search, filters
- **CartActivity**: Shopping cart management
- **CheckoutActivity**: Payment method selection and processing
- **PayNowWebViewActivity**: WebView for PayNow web payments
- **OrderTrackingActivity**: Real-time order status tracking

#### Utilities
- **DeliveryUtils.java**: Delivery fee calculation using Haversine formula

### Dependencies
- AndroidX AppCompat & Material Components
- Retrofit 2.9.0 for API calls
- OkHttp 4.12.0 with logging interceptor
- Gson 2.10.1 for JSON parsing
- Room 2.6.1 for local database
- Glide 4.16.0 for image loading
- Google Play Services (Location & Maps)
- Security Crypto for encrypted preferences

### Backend API
The app connects to a backend at `http://192.168.1.9:8000/`

Key endpoints:
- `POST /api/accounts/login/` - Login
- `POST /api/accounts/register/` - Register
- `GET /api/restaurants/` - Get restaurants
- `POST /api/orders/` - Create order
- `POST /api/payments/create/payment/` - Process payment

## User Preferences
- Currency: USD or ZWL
- Location-based restaurant filtering

## Build Instructions
1. Download this project
2. Open in Android Studio
3. Sync Gradle files
4. Update `BASE_URL` in `ApiClient.java` if needed
5. Add Google Maps API key in `AndroidManifest.xml` (optional)
6. Build and run on emulator or device

## Notes
- This is a native Android project, not compatible with Expo/React Native
- Requires Android Studio with Android SDK to build
- The project uses View Binding for type-safe view access
