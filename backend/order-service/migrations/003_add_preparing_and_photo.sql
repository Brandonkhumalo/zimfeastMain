-- Migration: Add preparing_started_at and delivery_photo columns to orders_order
-- These support the preparation timer/countdown and proof of delivery photo features.

ALTER TABLE orders_order ADD COLUMN IF NOT EXISTS preparing_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders_order ADD COLUMN IF NOT EXISTS delivery_photo VARCHAR(500);
ALTER TABLE orders_order ADD COLUMN IF NOT EXISTS delivery_photo_at TIMESTAMP WITH TIME ZONE;
