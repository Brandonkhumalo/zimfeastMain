FROM node:18-alpine AS builder

WORKDIR /app

COPY webapp/package*.json ./
RUN npm ci

COPY webapp/ .

ARG VITE_API_URL
ARG VITE_REALTIME_URL
ARG VITE_GOOGLE_MAPS_API_KEY

RUN npm run build

# Production: serve static files via nginx (copied to api-gateway volume)
FROM alpine:latest
COPY --from=builder /app/dist/public /app/frontend
