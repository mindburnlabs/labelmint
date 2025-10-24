-- Update tasks table to support new task types
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_type VARCHAR(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS media_type VARCHAR(20);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS config JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS validation_rules JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER DEFAULT 300;

-- Create specialized tables for different task types

-- Bounding boxes table
CREATE TABLE IF NOT EXISTS bounding_boxes (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    boxes JSONB NOT NULL, -- Array of bounding box objects with coordinates and labels
    image_width INTEGER NOT NULL,
    image_height INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);

-- Transcription table (for both image and audio)
CREATE TABLE IF NOT EXISTS transcriptions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    confidence_score DECIMAL(3,2), -- For automated confidence scoring
    duration_seconds INTEGER, -- For audio transcriptions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);

-- RLHF (Reinforcement Learning from Human Feedback) table
CREATE TABLE IF NOT EXISTS rlhf_comparisons (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    preferred_response VARCHAR(10) NOT NULL CHECK (preferred_response IN ('A', 'B', 'tie', 'both_bad')),
    reasoning TEXT, -- Optional reasoning for the choice
    response_a TEXT NOT NULL,
    response_b TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);

-- Sentiment analysis table
CREATE TABLE IF NOT EXISTS sentiment_analyses (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    key_phrases TEXT[], -- Array of important phrases identified
    emotion VARCHAR(20), -- Optional emotion classification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);

-- Task pricing configuration
CREATE TABLE IF NOT EXISTS task_pricing (
    id SERIAL PRIMARY KEY,
    task_type VARCHAR(50) NOT NULL,
    sub_type VARCHAR(50),
    base_price DECIMAL(10,4) NOT NULL, -- Price in USD
    complexity_multiplier DECIMAL(3,2) DEFAULT 1.0 CHECK (complexity_multiplier > 0),
    time_requirement INTEGER, -- Estimated time in seconds
    skill_level VARCHAR(20) DEFAULT 'basic' CHECK (skill_level IN ('basic', 'intermediate', 'advanced')),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_type, sub_type)
);

-- Insert default pricing for different task types
INSERT INTO task_pricing (task_type, sub_type, base_price, complexity_multiplier, time_requirement, skill_level, description) VALUES
-- Classification tasks (existing)
('classification', 'image', 0.0200, 1.0, 5, 'basic', 'Basic image classification with predefined categories'),
('classification', 'text', 0.0150, 1.0, 3, 'basic', 'Basic text classification with predefined categories'),

-- Bounding box tasks
('annotation', 'bounding_box', 0.0500, 2.5, 30, 'intermediate', 'Draw bounding boxes around objects in images'),
('annotation', 'polygon', 0.0800, 3.0, 45, 'advanced', 'Create polygon annotations for complex shapes'),
('annotation', 'keypoint', 0.0600, 2.0, 25, 'intermediate', 'Mark keypoints on objects or faces'),

-- Transcription tasks
('transcription', 'image_text', 0.0350, 1.75, 15, 'intermediate', 'Transcribe text from images'),
('transcription', 'handwriting', 0.0600, 3.0, 45, 'advanced', 'Transcribe handwritten text from images'),
('transcription', 'audio_general', 0.0400, 2.0, 60, 'intermediate', 'Transcribe general audio content'),
('transcription', 'audio_medical', 0.1500, 5.0, 300, 'advanced', 'Medical transcription requiring domain knowledge'),
('transcription', 'audio_legal', 0.1200, 4.0, 240, 'advanced', 'Legal transcription requiring domain knowledge'),

-- Sentiment analysis tasks
('sentiment', 'basic', 0.0250, 1.25, 10, 'basic', 'Basic sentiment analysis (positive/negative/neutral)'),
('sentiment', 'detailed', 0.0450, 2.0, 20, 'intermediate', 'Detailed sentiment with emotion classification'),
('sentiment', 'aspect_based', 0.0800, 3.0, 35, 'advanced', 'Aspect-based sentiment analysis'),

-- RLHF tasks
('rlhf', 'comparison', 0.0400, 2.0, 30, 'intermediate', 'Compare two AI responses and choose the better one'),
('rlhf', 'ranking', 0.0600, 2.5, 45, 'advanced', 'Rank multiple AI responses from best to worst'),
('rlhf', 'editing', 0.0800, 3.0, 60, 'advanced', 'Edit and improve AI responses'),

-- Data collection tasks
('collection', 'survey', 0.0300, 1.5, 30, 'basic', 'Complete surveys and provide opinions'),
('collection', 'data_entry', 0.0250, 1.25, 20, 'basic', 'Enter data from provided documents'),
('collection', 'research', 0.1000, 4.0, 300, 'advanced', 'Online research and data collection')

ON CONFLICT (task_type, sub_type) DO NOTHING;

-- Update tasks table with default values for new columns
UPDATE tasks SET
    sub_type = 'basic',
    time_limit_seconds = 300
WHERE sub_type IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_type_subtype ON tasks(type, sub_type);
CREATE INDEX IF NOT EXISTS idx_tasks_media_type ON tasks(media_type);
CREATE INDEX IF NOT EXISTS idx_bounding_boxes_task_id ON bounding_boxes(task_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_task_id ON transcriptions(task_id);
CREATE INDEX IF NOT EXISTS idx_rlhf_comparisons_task_id ON rlhf_comparisons(task_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_task_id ON sentiment_analyses(task_id);

-- Create function to get task pricing
CREATE OR REPLACE FUNCTION get_task_price(task_type_param VARCHAR, sub_type_param VARCHAR DEFAULT NULL)
RETURNS DECIMAL(10,4) AS $$
DECLARE
    task_price DECIMAL(10,4);
BEGIN
    SELECT base_price INTO task_price
    FROM task_pricing
    WHERE task_type = task_type_param
      AND (sub_type_param IS NULL OR sub_type = sub_type_param OR sub_type IS NULL)
      AND is_active = true
    ORDER BY
        CASE WHEN sub_type = sub_type_param THEN 1 ELSE 2 END
    LIMIT 1;

    IF task_price IS NULL THEN
        RETURN 0.02; -- Default price
    END IF;

    RETURN task_price;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate task earnings based on complexity
CREATE OR REPLACE FUNCTION calculate_task_earnings(task_id_param INTEGER)
RETURNS DECIMAL(10,4) AS $$
DECLARE
    task_info RECORD;
    base_earnings DECIMAL(10,4);
    time_bonus DECIMAL(10,4);
    total_earnings DECIMAL(10,4);
BEGIN
    SELECT t.*, tp.base_price, tp.complexity_multiplier, tp.time_requirement
    INTO task_info
    FROM tasks t
    LEFT JOIN task_pricing tp ON t.type = tp.task_type
        AND (t.sub_type = tp.sub_type OR tp.sub_type IS NULL)
    WHERE t.id = task_id_param;

    IF task_info.base_price IS NULL THEN
        base_earnings := 0.02;
    ELSE
        base_earnings := task_info.base_price;
    END IF;

    -- Apply complexity multiplier
    total_earnings := base_earnings * COALESCE(task_info.complexity_multiplier, 1.0);

    -- Add time bonus if completed faster than expected
    IF task_info.time_requirement IS NOT NULL THEN
        -- Example: 10% bonus if completed in half the expected time
        -- This would be calculated based on actual completion time
        time_bonus := total_earnings * 0.1;
        total_earnings := total_earnings + time_bonus;
    END IF;

    RETURN total_earnings;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set task points based on pricing
CREATE OR REPLACE FUNCTION set_task_points()
RETURNS TRIGGER AS $$
BEGIN
    NEW.points := (get_task_price(NEW.type, NEW.sub_type) * 100)::INTEGER; -- Convert to points
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_task_points_trigger ON tasks;
CREATE TRIGGER set_task_points_trigger
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_task_points();