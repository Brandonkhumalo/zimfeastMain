## ZimFeast Algorithm Implementation Tasks

Four algorithm improvements. All implemented. Delivery is fully outsourced to TumaGo.

---

### Task 1: Smarter ETA Estimation (High Impact, Low Effort) -- DONE
- **New files:** `backend/go-shared/eta/eta.go` — ETA calculator with Google Directions API, traffic multipliers, rolling prep time averages
- **Modified:**
  - `backend/realtime-service/internal/orderservice.go` — ActiveOrder now stores coordinates + ETA, computes ETA on every status change and driver location update, records actual prep times
  - `backend/realtime-service/internal/handlers.go` — HandleGetETA returns computed ETA breakdown
  - `backend/realtime-service/main.go` — initializes ETA calculator with Google API key, REST endpoint returns ETA
- **What it does:**
  - Google Directions API for real road distance/duration (falls back to Haversine x1.3)
  - Per-restaurant rolling average prep time (exponential moving average after 5 samples)
  - Time-of-day traffic multiplier: lunch (12-2pm) 1.3x, evening (5-8pm) 1.2x, off-peak 1.0x
  - 2.5 min pickup buffer
  - When TumaGo driver is assigned: recomputes ETA from driver's live GPS to delivery address
- **Status:** Done

### Task 2: Restaurant Search Ranking (Medium Impact, Low Effort) -- DONE
- **New files:** `backend/restaurant-service/restaurants/migrations/0002_add_ranking_fields.py`
- **Modified:**
  - `backend/restaurant-service/restaurants/models.py` — added `avg_prep_time`, `order_count` fields
  - `backend/restaurant-service/restaurants/views.py` — `list_nearby_restaurants()` now supports `?sort=ranked` (default) vs `?sort=distance`; added `_rank_restaurants()` composite scorer; added `internal_order_completed` endpoint
  - `backend/restaurant-service/restaurants/urls.py` — added `internal/restaurant/<id>/order-completed/`
- **Ranking formula:** `score = (0.30 x proximity) + (0.25 x rating) + (0.20 x prep_speed) + (0.15 x popularity) + (0.10 x is_open)`
- **Status:** Done

### Task 3: PostGIS Geospatial Indexing (Medium Impact, Medium Effort) -- DONE
- **New files:** `backend/restaurant-service/restaurants/migrations/0003_add_postgis_location.py`
- **Modified:**
  - `backend/docker-compose.yml` — switched `postgres:16-alpine` to `postgis/postgis:16-3.4-alpine`
  - `backend/init-db.sql` — enables PostGIS extension on zimfeast_restaurants and zimfeast_orders databases
  - `backend/restaurant-service/restaurants/models.py` — added `location` PointField(geography=True), auto-populated from lat/lng on save()
  - `backend/restaurant-service/config/settings.py` — added `django.contrib.gis` to INSTALLED_APPS, switched DB engine to PostGIS
  - `backend/restaurant-service/restaurants/views.py` — `list_nearby_restaurants()` uses `ST_DWithin` + `Distance` annotation when PostGIS data available, falls back to bounding box
  - `backend/go-shared/geo/geo.go` — added `MakePointSQL()`, `DistanceSQL()`, `DWithinSQL()` helpers for raw PostGIS queries
  - `backend/go-migrations.sql` — added `restaurant_location` and `delivery_location` geography columns with GIST indexes to orders_order
- **Status:** Done

### Task 4: Basic Fraud Detection (Medium Impact, Low Effort) -- DONE
- **New files:**
  - `backend/go-shared/fraud/fraud.go` — Go fraud checker with Redis TTL counters: velocity, geo anomaly, cancel abuse, payment pattern, promo abuse
  - `backend/shared/fraud.py` — Python fraud checker for payment-service: payment pattern detection, promo abuse, Redis alerts
- **Modified:**
  - `backend/order-service/internal/handlers/orders.go` — Handler now holds `fraud.Checker`; `CreateOrder` runs fraud checks before insert, records velocity + location after; `CancelOrder` records cancel for abuse detection
  - `backend/order-service/main.go` — initializes fraud checker with Redis client
  - `backend/payment-service/payments/views.py` — `_process_payment_callback` records failures and checks payment patterns; `create_payment` checks promo abuse by IP
- **Fraud signals:**
  - Velocity: > 3 orders in 10 min (score 2)
  - Geo anomaly: delivery > 5km from usual area (score 1)
  - Cancel abuse: > 3 cancels in 30 min (score 2)
  - Payment pattern: > 3 failed payments then success (score 2)
  - Promo abuse: same promo + IP > 3 times (score 3, blocks promo)
- **Alerts:** Flagged orders published to `orders.fraud.flagged` Redis channel for admin notification
- **Status:** Done

---

### Key Files
- ETA calculator: `backend/go-shared/eta/eta.go`
- ETA integration: `backend/realtime-service/internal/orderservice.go`
- Restaurant ranking: `backend/restaurant-service/restaurants/views.py` → `_rank_restaurants()`
- Restaurant stats endpoint: `backend/restaurant-service/restaurants/views.py` → `internal_order_completed()`
- PostGIS config: `backend/init-db.sql`, `backend/docker-compose.yml`, `backend/restaurant-service/config/settings.py`
- PostGIS model: `backend/restaurant-service/restaurants/models.py` → `Restaurant.location`
- PostGIS Go helpers: `backend/go-shared/geo/geo.go` → `MakePointSQL()`, `DistanceSQL()`, `DWithinSQL()`
- Fraud detection (Go): `backend/go-shared/fraud/fraud.go`
- Fraud detection (Python): `backend/shared/fraud.py`
- Fraud integration (orders): `backend/order-service/internal/handlers/orders.go`
- Fraud integration (payments): `backend/payment-service/payments/views.py`
- TumaGo API client: `backend/go-shared/tumago/client.go`
- TumaGo webhook handler: `backend/order-service/internal/handlers/webhook.go`
- Delivery fee: `backend/go-shared/geo/geo.go` → `CalculateDeliveryFee()`
