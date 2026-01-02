-- Add dual vision model validation setting
-- Migration: 007_add_dual_vision.sql

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS use_dual_vision_validation BOOLEAN DEFAULT false;

-- Update comment
COMMENT ON COLUMN settings.use_dual_vision_validation IS 'When true, uses both OpenAI and Ollama vision models and only creates links if both agree';
