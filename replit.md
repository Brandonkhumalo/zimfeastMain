# ZimFeast - Food Delivery Platform

> **Full Documentation**: See [DOCUMENTATION.md](./DOCUMENTATION.md) for complete technical documentation.
> **Local Setup**: See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for running locally on your machine.

## Overview
ZimFeast is a comprehensive food delivery platform designed for the Zimbabwean market. It connects customers, restaurants, and drivers through a full-stack application. The platform aims to provide a seamless ordering, delivery, and management experience, incorporating real-time tracking and multi-role functionalities. Its core purpose is to facilitate food delivery services efficiently across Zimbabwe.

## User Preferences
I want iterative development. Ask before making major changes.

## System Architecture
ZimFeast employs a three-tier architecture consisting of a React/Vite frontend, a Django/Django REST Framework backend, and a Node.js Realtime Server.

### Frontend
- **Framework**: React 18 with TypeScript, built using Vite 5.
- **UI/UX**: Utilizes Radix UI components styled with Tailwind CSS for a modern and responsive user interface.
- **State Management**: TanStack Query (React Query) for data fetching and state management.
- **Routing**: React Router DOM handles client-side navigation.
- **Features**: Includes multi-role UIs (Customer, Restaurant, Driver, Admin), Google Maps integration for tracking, and real-time order updates via WebSockets. Menu item images are mandatory for display, and external API management is integrated for restaurants.

### Backend
- **Framework**: Django 4.2 with Django REST Framework for robust API development.
- **Real-time**: Django Channels with Daphne ASGI server enables WebSocket communication for live order updates and notifications.
- **Database**: SQLite for development, with PostgreSQL planned for production.
- **Authentication**: Custom JWT implementation for secure user authentication across multiple roles.
- **API Endpoints**: Provides REST APIs for accounts, restaurants, orders, drivers, and payments.

### Realtime Server
- **Technology**: Node.js with Socket.IO and Redis.
- **Functionality**: Manages real-time delivery coordination, including driver matching using a nearest-driver algorithm, delivery offer management with timeouts, and real-time location updates. It subscribes to Redis for new order notifications from the Django backend.

### Inter-Service Communication
- Frontend communicates with the Backend via HTTP API and with the Realtime Server via Socket.IO.
- Backend publishes events to Redis, which the Realtime Server subscribes to.
- Realtime Server communicates with the Backend via HTTP for driver assignments and status updates.

### Deployment Strategy
- The application is designed for production deployment on a Reserved VM.
- In production, Django serves both the REST API and the built React frontend static files. Frontend routes for `/api/*` are proxied to the Django backend, while other routes serve the React single-page application.

## External Dependencies
- **Google Maps API**: Used across frontend and backend for maps display, geocoding, distance calculations, and real-time driver tracking.
- **Paynow**: Integrated for payment processing within Zimbabwe.
- **SendGrid**: Used for email services.
- **Redis**: Essential for inter-service communication and real-time features, facilitating Pub/Sub messaging between Django and the Node.js Realtime Server.
- **Socket.IO**: Powers real-time, bi-directional communication between clients (frontend, driver app) and the Realtime Server.