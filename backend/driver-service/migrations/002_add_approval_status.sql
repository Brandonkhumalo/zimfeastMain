-- Migration: Add driver approval workflow columns
ALTER TABLE drivers_driver ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE drivers_driver ADD COLUMN IF NOT EXISTS approval_notes TEXT;
ALTER TABLE drivers_driver ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE drivers_driver ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_drivers_approval_status ON drivers_driver(approval_status);
