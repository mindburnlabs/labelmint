-- Enhanced quality control system migration

-- Add accuracy tracking to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS accuracy_rate DECIMAL(5,2) DEFAULT 0.00 CHECK (accuracy_rate >= 0 AND accuracy_rate <= 100),
ADD COLUMN IF NOT EXISTS total_labels INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS correct_labels INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_warning_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS block_reason TEXT,
ADD COLUMN IF NOT EXISTS bonus_earned DECIMAL(10,2) DEFAULT 0.00;

-- Add enhanced task tracking
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS total_responses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unique_labels INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consensus_level VARCHAR(20) DEFAULT 'pending' CHECK (consensus_level IN ('pending', 'partial', 'complete', 'conflict')),
ADD COLUMN IF NOT EXISTS final_label TEXT,
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2) DEFAULT 0.00 CHECK (quality_score >= 0 AND quality_score <= 1),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Add response quality tracking
ALTER TABLE responses
ADD COLUMN IF NOT EXISTS is_consensus BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bonus_multiplier DECIMAL(3,2) DEFAULT 1.00 CHECK (bonus_multiplier >= 0.5 AND bonus_multiplier <= 2.0),
ADD COLUMN IF NOT EXISTS base_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS accuracy_at_time DECIMAL(5,2) DEFAULT 0.00;

-- Create worker accuracy history table for tracking performance over time
CREATE TABLE IF NOT EXISTS worker_accuracy_history (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  labels_submitted INTEGER DEFAULT 0,
  correct_labels INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
  points_earned DECIMAL(10,2) DEFAULT 0.00,
  bonus_earned DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(worker_id, date)
);

-- Create task consensus tracking table
CREATE TABLE IF NOT EXISTS task_consensus (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE UNIQUE,
  label_a TEXT,
  label_b TEXT,
  label_c TEXT,
  label_d TEXT,
  label_e TEXT,
  count_a INTEGER DEFAULT 0,
  count_b INTEGER DEFAULT 0,
  count_c INTEGER DEFAULT 0,
  count_d INTEGER DEFAULT 0,
  count_e INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  consensus_reached BOOLEAN DEFAULT FALSE,
  consensus_label TEXT,
  consensus_confidence DECIMAL(3,2) DEFAULT 0.00,
  required_responses INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create worker warnings table
CREATE TABLE IF NOT EXISTS worker_warnings (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  warning_type VARCHAR(50) NOT NULL CHECK (warning_type IN ('accuracy_low', 'accuracy_critical', 'honeypot_fail', 'quality_issue')),
  message TEXT NOT NULL,
  accuracy_at_time DECIMAL(5,2),
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to calculate worker accuracy
CREATE OR REPLACE FUNCTION calculate_worker_accuracy(worker_id_param INTEGER)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  accuracy DECIMAL(5,2);
BEGIN
  SELECT
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(
          (COUNT(CASE WHEN is_correct = TRUE THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100,
          2
        )
      ELSE 0
    END
  INTO accuracy
  FROM responses
  WHERE user_id = worker_id_param
    AND is_correct IS NOT NULL;

  RETURN accuracy;
END;
$$ LANGUAGE plpgsql;

-- Create function to update task consensus
CREATE OR REPLACE FUNCTION update_task_consensus(task_id_param INTEGER)
RETURNS VOID AS $$
DECLARE
  total_resp INTEGER;
  unique_labels_count INTEGER;
  top_label TEXT;
  top_count INTEGER;
  consensus_threshold INTEGER := 3;
BEGIN
  -- Count total responses
  SELECT COUNT(*) INTO total_resp
  FROM responses
  WHERE task_id = task_id_param;

  -- Count unique labels
  SELECT COUNT(DISTINCT answer) INTO unique_labels_count
  FROM responses
  WHERE task_id = task_id_param;

  -- Get top label and count
  SELECT answer, COUNT(*) INTO top_label, top_count
  FROM responses
  WHERE task_id = task_id_param
  GROUP BY answer
  ORDER BY COUNT(*) DESC, answer
  LIMIT 1;

  -- Update task with consensus info
  UPDATE tasks
  SET total_responses = total_resp,
      unique_labels = unique_labels_count,
      consensus_label = CASE
        WHEN top_count >= 2 THEN top_label
        ELSE consensus_label
      END,
      consensus_count = top_count,
      consensus_level = CASE
        WHEN total_resp >= 3 AND top_count >= 3 THEN 'complete'
        WHEN total_resp >= 3 AND top_count = 2 THEN 'partial'
        WHEN total_resp >= 5 THEN 'conflict'
        ELSE 'pending'
      END,
      completion_status = CASE
        WHEN total_resp >= 3 AND top_count >= 3 THEN 'completed'
        WHEN total_resp >= 5 THEN 'review'
        ELSE 'pending'
      END,
      final_label = CASE
        WHEN total_resp >= 3 AND top_count >= 3 THEN top_label
        ELSE NULL
      END
  WHERE id = task_id_param;

  -- Update consensus tracking
  INSERT INTO task_consensus (task_id, total_responses, consensus_reached, consensus_label, consensus_confidence)
  VALUES (task_id_param, total_resp, top_count >= 3, top_label, top_count::DECIMAL / total_resp::DECIMAL)
  ON CONFLICT (task_id)
  UPDATE SET
    total_responses = EXCLUDED.total_responses,
    consensus_reached = EXCLUDED.consensus_reached,
    consensus_label = EXCLUDED.consensus_label,
    consensus_confidence = EXCLUDED.consensus_confidence,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to check and update worker status based on accuracy
CREATE OR REPLACE FUNCTION update_worker_status(worker_id_param INTEGER)
RETURNS TEXT AS $$
DECLARE
  accuracy DECIMAL(5,2);
  user_record RECORD;
  status_message TEXT;
BEGIN
  -- Get current user data
  SELECT * INTO user_record FROM users WHERE id = worker_id_param;

  -- Calculate accuracy
  accuracy := calculate_worker_accuracy(worker_id_param);

  -- Update user accuracy
  UPDATE users
  SET accuracy_rate = accuracy
  WHERE id = worker_id_param;

  -- Check for blocking conditions
  IF accuracy < 50 AND user_record.total_labels >= 10 THEN
    -- Block worker
    UPDATE users
    SET is_blocked = TRUE,
        blocked_at = NOW(),
        block_reason = 'Accuracy below 50% (' || accuracy || '%)'
    WHERE id = worker_id_param;

    status_message := 'BLOCKED';

  ELSIF accuracy < 70 AND user_record.total_labels >= 5 AND user_record.warning_count = 0 THEN
    -- Issue warning
    UPDATE users
    SET warning_count = warning_count + 1,
        last_warning_at = NOW()
    WHERE id = worker_id_param;

    INSERT INTO worker_warnings (worker_id, warning_type, message, accuracy_at_time)
    VALUES (worker_id_param, 'accuracy_low', 'Your accuracy is below 70%. Please improve to avoid being blocked.', accuracy);

    status_message := 'WARNING';

  ELSIF accuracy >= 90 THEN
    -- High accuracy - eligible for bonus
    status_message := 'BONUS_ELIGIBLE';

  ELSE
    status_message := 'OK';
  END IF;

  -- Update daily accuracy history
  INSERT INTO worker_accuracy_history (worker_id, date, labels_submitted, correct_labels, accuracy_rate)
  VALUES (worker_id_param, CURRENT_DATE, user_record.total_labels, user_record.correct_labels, accuracy)
  ON CONFLICT (worker_id, date)
  UPDATE SET
    labels_submitted = EXCLUDED.labels_submitted,
    correct_labels = EXCLUDED.correct_labels,
    accuracy_rate = EXCLUDED.accuracy_rate;

  RETURN status_message;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_accuracy_rate ON users(accuracy_rate);
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);
CREATE INDEX IF NOT EXISTS idx_tasks_consensus_level ON tasks(consensus_level);
CREATE INDEX IF NOT EXISTS idx_tasks_total_responses ON tasks(total_responses);
CREATE INDEX IF NOT EXISTS idx_responses_is_consensus ON responses(is_consensus);
CREATE INDEX IF NOT EXISTS idx_worker_accuracy_history_date ON worker_accuracy_history(date);
CREATE INDEX IF NOT EXISTS idx_worker_warnings_worker_id ON worker_warnings(worker_id);
CREATE INDEX IF NOT EXISTS idx_task_consensus_task_id ON task_consensus(task_id);

-- Create trigger to update consensus after response
CREATE OR REPLACE FUNCTION after_response_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update task consensus
  PERFORM update_task_consensus(NEW.task_id);

  -- Update worker status every 5 responses
  IF (SELECT COUNT(*) FROM responses WHERE user_id = NEW.user_id) % 5 = 0 THEN
    PERFORM update_worker_status(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trigger_after_response_insert ON responses;
CREATE TRIGGER trigger_after_response_insert
  AFTER INSERT ON responses
  FOR EACH ROW
  EXECUTE FUNCTION after_response_insert();