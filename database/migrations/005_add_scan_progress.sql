-- Add progress tracking fields to scans table
-- Migration: 005_add_scan_progress.sql

ALTER TABLE scans
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_step TEXT DEFAULT 'Initializing...',
ADD COLUMN IF NOT EXISTS total_requirements INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processed_requirements INTEGER DEFAULT 0;

-- Add index for querying in-progress scans
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
