#!/bin/bash

# Start Redis server in background
redis-server --daemonize yes --port 6379

# Wait a moment for Redis to start
sleep 1

# Verify Redis is running
if redis-cli ping > /dev/null 2>&1; then
    echo "Redis server started successfully"
else
    echo "Warning: Redis failed to start, WebSocket features may not work"
fi

cd ZimFeast
export DJANGO_SETTINGS_MODULE=ZimFeast.settings
daphne -b 0.0.0.0 -p 8000 ZimFeast.asgi:application
