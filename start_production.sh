#!/bin/bash

echo "Building React frontend for production..."
npm run build

echo "Collecting static files..."
cd ZimFeast
python manage.py collectstatic --noinput

echo "Starting production server on port 5000..."
daphne -b 0.0.0.0 -p 5000 ZimFeast.asgi:application
