-- Go Services Database Schema
-- Run this ONLY if you're deploying Go services without first running Django migrations.
-- If Django migrations have already been run, these tables already exist.
-- All statements use IF NOT EXISTS for safety.

-- ============================================================
-- Order Service Database (zimfeast_orders)
-- ============================================================
\connect zimfeast_orders;

CREATE TABLE IF NOT EXISTS orders_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
    method VARCHAR(20) NOT NULL DEFAULT 'delivery',
    customer_id UUID NOT NULL,
    driver_id UUID,
    restaurant_id UUID NOT NULL,
    total_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    tip DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    each_item_price TEXT,
    restaurant_lat DOUBLE PRECISION,
    restaurant_lng DOUBLE PRECISION,
    delivery_lat DOUBLE PRECISION,
    delivery_lng DOUBLE PRECISION,
    delivery_address TEXT,
    driver_name VARCHAR(255),
    driver_phone VARCHAR(50),
    driver_vehicle TEXT,
    restaurant_names TEXT,
    external_order_numbers TEXT,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    delivery_out_time TIMESTAMP WITH TIME ZONE,
    delivery_complete_time TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_order_status_driver ON orders_order(status, driver_id);
CREATE INDEX IF NOT EXISTS idx_order_created ON orders_order(created DESC);
CREATE INDEX IF NOT EXISTS idx_order_customer ON orders_order(customer_id, created DESC);
CREATE INDEX IF NOT EXISTS idx_order_restaurant ON orders_order(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_scheduled ON orders_order(status, scheduled_for) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS orders_orderitem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders_order(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    menu_item_id UUID NOT NULL,
    menu_item_name VARCHAR(255) NOT NULL,
    menu_item_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    added TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orderitem_order ON orders_orderitem(order_id);

-- Migration: Add scheduled_for column to existing orders_order table
-- This is safe to run multiple times (idempotent via IF NOT EXISTS / DO block).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders_order' AND column_name = 'scheduled_for'
    ) THEN
        ALTER TABLE orders_order ADD COLUMN scheduled_for TIMESTAMP WITH TIME ZONE;
        CREATE INDEX IF NOT EXISTS idx_order_scheduled ON orders_order(status, scheduled_for) WHERE status = 'scheduled';
    END IF;
END
$$;

-- ============================================================
-- TumaGo Integration Columns (orders_order)
-- ============================================================
ALTER TABLE orders_order ADD COLUMN IF NOT EXISTS tumago_delivery_id UUID;
ALTER TABLE orders_order ADD COLUMN IF NOT EXISTS tumago_status VARCHAR(32) DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_order_tumago_delivery ON orders_order(tumago_delivery_id) WHERE tumago_delivery_id IS NOT NULL;

-- ============================================================
-- Preparation timer and delivery proof columns (orders_order)
-- ============================================================
ALTER TABLE orders_order ADD COLUMN IF NOT EXISTS preparing_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders_order ADD COLUMN IF NOT EXISTS delivery_photo VARCHAR(500);
ALTER TABLE orders_order ADD COLUMN IF NOT EXISTS delivery_photo_at TIMESTAMP WITH TIME ZONE;

-- Distance calculations use the lat/lng columns above so this schema works on
-- plain PostgreSQL services that do not include PostGIS.
