-- Add vision model settings and confidence threshold
-- Migration: 006_add_vision_settings.sql

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS openai_vision_model VARCHAR(100) DEFAULT 'gpt-4o',
ADD COLUMN IF NOT EXISTS ollama_vision_model VARCHAR(100) DEFAULT 'qwen2-vl',
ADD COLUMN IF NOT EXISTS min_confidence_threshold REAL DEFAULT 0.90;

-- Update openai_model default to gpt-4o (better vision capabilities)
UPDATE settings
SET openai_model = 'gpt-4o',
    openai_vision_model = 'gpt-4o',
    ollama_vision_model = 'qwen2-vl',
    min_confidence_threshold = 0.90
WHERE id = 1 AND openai_model = 'gpt-4o-mini';
