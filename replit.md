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
