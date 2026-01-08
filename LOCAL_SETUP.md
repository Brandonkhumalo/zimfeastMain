# ZimFeast Local Development Setup

This guide explains how to run the three ZimFeast applications locally on your machine.

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **Redis** (for inter-service communication)
- **Git**

## Project Structure

```
ZimFeast/
├── src/                      # React Frontend
├── ZimFeast/                 # Django Backend
├── real-time-server/         # Node.js Realtime Server
└── LOCAL_SETUP.md           # This file
```

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd ZimFeast

# Install frontend dependencies
npm install

# Install backend dependencies
cd ZimFeast
pip install -r requirements.txt
cd ..

# Install realtime server dependencies
cd real-time-server
npm install
cd ..
```

### 2. Configure Environment Variables

Create the following `.env` files:

**Root `.env` (for Frontend):**
```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_API_URL=http://localhost:8000
VITE_REALTIME_URL=http://localhost:3001
```

**`ZimFeast/.env` (for Django Backend):**
```env
SECRET_KEY=your-django-secret-key-here
DEBUG=True
GOOGLE_API_KEY=your_google_maps_api_key
SENDGRID_API_KEY=your_sendgrid_api_key
PAYNOW_INTEGRATION_ID=your_paynow_id
PAYNOW_INTEGRATION_KEY=your_paynow_key
REDIS_URL=redis://localhost:6379
DATABASE_URL=sqlite:///db.sqlite3
```

**`real-time-server/.env` (for Realtime Server):**
```env
GOOGLE_API_KEY=your_google_maps_api_key
REDIS_URL=redis://localhost:6379
DJANGO_URL=http://localhost:8000
REALTIME_PORT=3001
```

### 3. Start Redis

Redis is required for communication between Django and the Realtime Server.

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

**Windows:**
Use WSL2 or Docker:
```bash
docker run -d -p 6379:6379 redis:alpine
```

### 4. Initialize the Database

```bash
cd ZimFeast
python manage.py migrate
python manage.py createsuperuser  # Create admin account
cd ..
```

### 5. Start All Three Servers

Open three terminal windows/tabs:

**Terminal 1 - Frontend (React/Vite):**
```bash
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 - Backend (Django):**
```bash
cd ZimFeast
daphne -b 0.0.0.0 -p 8000 ZimFeast.asgi:application
# Runs on http://localhost:8000
```

**Terminal 3 - Realtime Server (Node.js):**
```bash
cd real-time-server
npm start
# Runs on http://localhost:3001
```

## Application URLs

| Application | URL | Description |
|-------------|-----|-------------|
| Frontend | http://localhost:5000 | React web application |
| Backend API | http://localhost:8000/api/ | Django REST API |
| Admin Panel | http://localhost:8000/admin/ | Django admin |
| Realtime Server | http://localhost:3001 | Socket.IO server |

## Testing the Setup

1. Open http://localhost:5000 in your browser
2. You should see the ZimFeast landing page
3. Check browser console for any connection errors
4. Verify Redis connection in Realtime Server logs

## Troubleshooting

### "Redis connection refused"
- Make sure Redis is running: `redis-cli ping` should return `PONG`
- Check Redis is on port 6379

### "CORS errors in browser"
- Django has CORS configured for localhost
- Make sure you're accessing via `http://localhost:5000`, not `127.0.0.1`

### "Google Maps not loading"
- Verify your `GOOGLE_API_KEY` is correct
- Check API key has Maps JavaScript API enabled
- Check browser console for API errors

### "Socket.IO connection failed"
- Verify Realtime Server is running on port 3001
- Check `VITE_REALTIME_URL` in frontend .env

## Development Scripts

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Backend
python manage.py runserver     # Development server (without WebSocket)
daphne ZimFeast.asgi:application  # ASGI server (with WebSocket)
python manage.py migrate       # Run database migrations
python manage.py createsuperuser  # Create admin user

# Realtime Server
npm start           # Start server
npm run dev         # Start with auto-reload
```

## Architecture Overview

```
┌─────────────────┐     HTTP API      ┌─────────────────┐
│    Frontend     │◄─────────────────►│     Backend     │
│   (Port 5000)   │                   │   (Port 8000)   │
│   React/Vite    │                   │  Django/Daphne  │
└────────┬────────┘                   └────────┬────────┘
         │                                     │
         │ Socket.IO                           │ Redis Pub/Sub
         │                                     │
         ▼                                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Realtime Server                        │
│                     (Port 3001)                          │
│                  Node.js/Socket.IO                       │
└─────────────────────────────────────────────────────────┘
```

## Mobile App Development

For Android driver/customer app development, update these URLs in the mobile code:

- `BASE_URL`: `http://10.0.2.2:8000` (Android emulator to localhost)
- `SOCKET_URL`: `http://10.0.2.2:3001` (Android emulator to localhost)

For physical device testing, use your computer's local IP address instead.
