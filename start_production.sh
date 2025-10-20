#!/bin/bash

echo "Building React frontend for production..."
npm run build

echo "Starting production server on port 5000..."
cd ZimFeast
daphne -b 0.0.0.0 -p 5000 ZimFeast.asgi:application
