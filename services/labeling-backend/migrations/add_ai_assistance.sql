-- AI-Assisted Labeling System Migration

-- Add AI-related fields to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS ai_prelabel TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2) DEFAULT 0.00 CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
ADD COLUMN IF NOT EXISTS ai_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_validation_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_suggestion TEXT,
ADD COLUMN IF NOT EXISTS ai_model_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS uses_ai_assistance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consensus_target INTEGER DEFAULT 3; -- Can be 2 or 3 based on AI confidence

-- Add AI validation fields to responses table
ALTER TABLE responses
ADD COLUMN IF NOT EXISTS ai_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_validation_score DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS ai_validation_issues TEXT[],
ADD COLUMN IF NOT EXISTS ai_flagged_as_suspicious BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_validation_at TIMESTAMP WITH TIME ZONE;

-- Create AI prelabeling table for batch processing
CREATE TABLE IF NOT EXISTS ai_prelabels (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  ai_model VARCHAR(50) NOT NULL,
  prediction TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  validated_by INTEGER REFERENCES users(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  is_correct BOOLEAN
);

-- Create worker behavior analysis table
CREATE TABLE IF NOT EXISTS worker_behavior_analysis (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  total_submissions INTEGER DEFAULT 0,
  avg_time_per_task DECIMAL(5,2) DEFAULT 0.00,
  unique_labels_used INTEGER DEFAULT 0,
  pattern_detected VARCHAR(100),
  suspicious_score DECIMAL(3,2) DEFAULT 0.00 CHECK (suspicious_score >= 0 AND suspicious_score <= 1),
  auto_flagged BOOLEAN DEFAULT FALSE,
  reviewed_by INTEGER REFERENCES users(id),
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(worker_id, analysis_date)
);

-- Create task examples table for generated examples
CREATE TABLE IF NOT EXISTS task_examples (
  id SERIAL PRIMARY KEY,
  task_type VARCHAR(100) NOT NULL,
  category TEXT NOT NULL,
  example_input TEXT NOT NULL,
  example_output TEXT NOT NULL,
  explanation TEXT,
  ai_generated BOOLEAN DEFAULT TRUE,
  ai_model VARCHAR(50),
  approved BOOLEAN DEFAULT FALSE,
  approved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI validation queue for batch processing
CREATE TABLE IF NOT EXISTS ai_validation_queue (
  id SERIAL PRIMARY KEY,
  response_id INTEGER REFERENCES responses(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0, -- 0=normal, 1=high, 2=urgent
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Update functions to support AI-assisted consensus
CREATE OR REPLACE FUNCTION calculate_ai_assisted_consensus(task_id_param INTEGER)
RETURNS VOID AS $$
DECLARE
  ai_conf DECIMAL;
  has_ai BOOLEAN;
  target_consensus INTEGER;
  total_resp INTEGER;
  top_label TEXT;
  top_count INTEGER;
  ai_label TEXT;
BEGIN
  -- Get AI prelabel info
  SELECT COALESCE(ai_confidence, 0), COALESCE(ai_prelabel IS NOT NULL, false)
  INTO ai_conf, has_ai
  FROM tasks
  WHERE id = task_id_param;

  -- Determine consensus target based on AI confidence
  IF has_ai AND ai_conf > 0.9 THEN
    target_consensus := 2; -- High confidence AI, need only 2 human labels
  ELSIF has_ai AND ai_conf > 0.7 THEN
    target_consensus := 2; -- Medium confidence AI, need 2 human labels
  ELSE
    target_consensus := 3; -- No AI or low confidence, need 3 human labels
  END IF;

  -- Update task with new consensus target
  UPDATE tasks
  SET consensus_target = target_consensus
  WHERE id = task_id_param;

  -- Get current response counts
  SELECT COUNT(*) INTO total_resp
  FROM responses
  WHERE task_id = task_id_param;

  -- Get top label
  SELECT answer, COUNT(*) INTO top_label, top_count
  FROM responses
  WHERE task_id = task_id_param
  GROUP BY answer
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Check consensus
  IF top_count >= target_consensus THEN
    UPDATE tasks
    SET consensus_label = top_label,
        consensus_count = top_count,
        consensus_level = 'complete',
        completion_status = 'completed',
        final_label = top_label,
        reviewed_at = NOW()
    WHERE id = task_id_param;
  ELSIF total_resp >= target_consensus + 1 THEN
    -- Too many responses without consensus
    UPDATE tasks
    SET consensus_level = 'conflict',
        completion_status = 'review'
    WHERE id = task_id_param;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to automatically pre-label text tasks
CREATE OR REPLACE FUNCTION auto_prelabel_text_tasks()
RETURNS INTEGER AS $$
DECLARE
  tasks_to_label INTEGER;
  task_record RECORD;
BEGIN
  tasks_to_label := 0;

  -- Find unprocessed text classification tasks
  FOR task_record IN
    SELECT id, data, options, title
    FROM tasks
    WHERE type IN ('text_classification', 'sentiment_analysis', 'content_moderation')
      AND ai_prelabel IS NULL
      AND completion_status = 'pending'
      AND data->>'text' IS NOT NULL
    LIMIT 10
  LOOP
    -- This would be called by a background worker
    -- INSERT INTO ai_prelabel_queue (task_id) VALUES (task_record.id);
    tasks_to_label := tasks_to_label + 1;
  END LOOP;

  RETURN tasks_to_label;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for AI-assisted consensus
DROP TRIGGER IF EXISTS trigger_ai_assisted_consensus ON responses;
CREATE TRIGGER trigger_ai_assisted_consensus
  AFTER INSERT ON responses
  FOR EACH ROW
  EXECUTE FUNCTION calculate_ai_assisted_consensus(NEW.task_id);

-- Create indexes for AI features
CREATE INDEX IF NOT EXISTS idx_tasks_ai_prelabel ON tasks(ai_prelabel);
CREATE INDEX IF NOT EXISTS idx_tasks_ai_confidence ON tasks(ai_confidence);
CREATE INDEX IF NOT EXISTS idx_tasks_uses_ai_assistance ON tasks(uses_ai_assistance);
CREATE INDEX IF NOT EXISTS idx_responses_ai_validated ON responses(ai_validated);
CREATE INDEX IF NOT EXISTS idx_responses_ai_flagged ON responses(ai_flagged_as_suspicious);
CREATE INDEX IF NOT EXISTS idx_ai_prelabels_task_id ON ai_prelabels(task_id);
CREATE INDEX IF NOT EXISTS idx_worker_behavior_worker_date ON worker_behavior_analysis(worker_id, analysis_date);
CREATE INDEX IF NOT EXISTS idx_ai_validation_queue_status ON ai_validation_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_task_examples_category ON task_examples(category, task_type);

-- Create view for AI-assisted tasks
CREATE OR REPLACE VIEW ai_assisted_tasks AS
SELECT
  t.id,
  t.title,
  t.type,
  t.ai_prelabel,
  t.ai_confidence,
  t.consensus_target,
  t.total_responses,
  t.consensus_level,
  CASE
    WHEN t.ai_prelabel IS NOT NULL THEN 'AI Assisted'
    ELSE 'Standard'
  END as labeling_mode,
  CASE
    WHEN t.ai_confidence > 0.9 THEN 'High Confidence'
    WHEN t.ai_confidence > 0.7 THEN 'Medium Confidence'
    WHEN t.ai_prelabel IS NOT NULL THEN 'Low Confidence'
    ELSE 'No AI'
  END as ai_confidence_level
FROM tasks t
WHERE t.uses_ai_assistance = true OR t.ai_prelabel IS NOT NULL;

-- Create view for worker quality metrics with AI validation
CREATE OR REPLACE VIEW worker_quality_metrics AS
SELECT
  u.id as worker_id,
  u.username,
  u.accuracy_rate,
  u.total_labels,
  COUNT(r.id) as labels_validated_by_ai,
  AVG(r.ai_validation_score) as avg_ai_score,
  COUNT(CASE WHEN r.ai_flagged_as_suspicious = true THEN 1 END) as suspicious_count,
  CASE
    WHEN COUNT(CASE WHEN r.ai_flagged_as_suspicious = true THEN 1 END) > COUNT(r.id) * 0.1 THEN 'High Risk'
    WHEN COUNT(CASE WHEN r.ai_flagged_as_suspicious = true THEN 1 END) > 0 THEN 'Medium Risk'
    ELSE 'Low Risk'
  END as risk_level
FROM users u
LEFT JOIN responses r ON r.user_id = u.id
WHERE u.role = 'worker'
GROUP BY u.id, u.username, u.accuracy_rate, u.total_labels;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT ON ai_prelabels TO labeling_worker;
-- GRANT SELECT, INSERT ON worker_behavior_analysis TO labeling_worker;
-- GRANT SELECT ON ai_assisted_tasks TO labeling_worker;

COMMIT;