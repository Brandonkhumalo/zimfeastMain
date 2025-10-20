# ZimFeast - Food Delivery Platform

## Overview
ZimFeast is a full-stack food delivery platform for Zimbabwe, built with React/Vite frontend and Django/Channels backend. The application supports multiple user roles: customers, restaurants, drivers, and administrators.

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **UI Components**: Radix UI with Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router DOM
- **Maps**: Google Maps API integration

### Backend
- **Framework**: Django 4.2 with Django REST Framework
- **WebSocket**: Django Channels with Daphne ASGI server
- **Database**: SQLite (development) - migrate to PostgreSQL for production
- **Authentication**: Custom JWT implementation
- **Real-time**: WebSocket support for live order updates and driver tracking

## Project Structure

```
.
├── src/                    # React frontend source
│   ├── components/        # Reusable UI components
│   ├── pages/            # Page components for different user roles
│   ├── hooks/            # Custom React hooks
│   └── lib/              # Utility functions
├── ZimFeast/             # Django backend
│   ├── accounts/         # User authentication
│   ├── restaurants/      # Restaurant management
│   ├── orders/          # Order processing
│   ├── drivers/         # Driver assignment
│   └── payments/        # Payment integration (Paynow)
├── shared/              # Shared utilities between frontend/backend
└── node_modules/        # NPM dependencies
```

## Environment Setup

### Required Environment Variables
The following environment variables are configured in `ZimFeast/.env`:
- `SECRET_KEY`: Django secret key
- `GOOGLE_API_KEY`: Google Maps API key
- `SENDGRID_API_KEY`: SendGrid email service
- `PAYNOW_*`: Paynow payment gateway credentials
- `REDIS_URL`: Redis for WebSocket channels (optional in development)

## Development

### Running the Application
Two workflows are configured and running automatically:
1. **Frontend**: Runs on port 5000 using `npm run dev`
2. **Backend**: Runs on port 8000 using Daphne ASGI server

### Database Migrations
```bash
cd ZimFeast
python manage.py migrate
python manage.py createsuperuser  # Create admin account
```

### Key Features
- Multi-role authentication (Customer, Restaurant, Driver, Admin)
- Real-time order tracking with WebSocket
- Google Maps integration for delivery tracking
- Restaurant menu management
- Payment processing via Paynow
- Driver assignment algorithm
- Live order status updates

## User Roles

1. **Customer**: Browse restaurants, place orders, track deliveries
2. **Restaurant**: Manage menu items, process orders, view analytics
3. **Driver**: Accept deliveries, update delivery status, track earnings
4. **Admin**: Manage all restaurants and drivers, view system analytics

## API Backend
The Django backend exposes REST API endpoints at:
- `/api/accounts/` - User authentication and profiles
- `/api/restaurants/` - Restaurant and menu management
- `/api/orders/` - Order processing
- `/api/drivers/` - Driver management
- `/api/payments/` - Payment processing

WebSocket connections are available for:
- Live order updates
- Driver location tracking
- Real-time notifications

## Notes
- Frontend uses localhost to communicate with backend (both run in same environment)
- SQLite is used for development; production should use PostgreSQL
- Redis is optional in development but required in production for WebSocket support
- The project includes demo data for testing

## Recent Changes
- Successfully configured for Replit environment
- Fixed Python dependencies and installed all required packages
- Configured Vite to allow all hosts for Replit proxy
- Set up Django CORS to accept all origins in development
- Fixed Django ASGI import order for Channels
- Created workflows for both frontend and backend servers
- **Made menu item images mandatory**: Updated both frontend and backend to require image upload when adding menu items
  - Frontend now includes image preview functionality
  - Backend enforces image field requirement
  - Migration applied to update database schema
- **Added External API management**: Restaurants can now add external API integrations
  - Added "External APIs" button in restaurant dashboard with modern gradient styling
  - Created ExternalAPIDialog component with form validation
  - Supports multiple API categories (Menu API, Meal Data, Categories, Inventory, Analytics, Custom)
  - Securely stores API URLs and optional API keys
  - Connected to backend endpoint for API management
- **Cleaned up frontend demo data and integrated real backend**:
  - Created 10 real restaurants in database with 30 menu items (3 per restaurant)
  - All restaurants have external API integrations with category "get_menu"
  - Removed all demo/mock data from CustomerApp, CartComponent, and DeliveryHistory
  - Fixed API calls to use real backend endpoints with proper authentication
  - Fixed pagination to work with full cursor URLs
  - Updated cart system to include restaurant location data for order creation
- **Fixed restaurant data structure alignment (Oct 20, 2025)**:
  - Reorganized Django URL patterns in `restaurants/urls.py` - specific paths like `nearby/` and `get/all/` now come BEFORE dynamic `<str:restaurant_id>/` pattern to prevent incorrect URL matching
  - Updated frontend Restaurant type definition to match backend API response structure (cuisines array instead of cuisineType string)
  - Fixed RestaurantCard component to properly display cuisines array and use correct field names (lat/lng instead of coordinates object)
  - Restaurant data now correctly flows from backend to frontend with all 10 pre-populated restaurants
- **Implemented Menu Dialog for Customer App (Oct 20, 2025)**:
  - Created MenuDialog component that displays restaurant menu items when customers click "View Menu"
  - Dialog shows menu items with images, descriptions, categories, availability status, and prices
  - Each menu item has an "Add to Cart" button that adds the item to cart with proper restaurant location data
  - Updated RestaurantCard to show menu item count on "View Menu" button
  - Updated RestaurantGrid and TopRestaurant components to use menu dialog workflow
  - Added toast notification when items are added to cart
  - Dialog properly resets state on close for cleanliness (architect reviewed and approved)
- **Fixed Checkout "Order not found" Error (Oct 20, 2025)**:
  - Fixed CheckoutForm.tsx to use relative API URLs instead of hardcoded `http://127.0.0.1:8000`
  - All API calls now work through Vite proxy in Replit environment
  - Fixed endpoints: order details, voucher balance, payment creation, voucher deposit, and payment status polling
  - Order checkout flow now works correctly from cart → order creation → checkout page
