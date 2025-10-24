-- Add task reservation system fields
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS reserved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_honeypot BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consensus_label TEXT,
ADD COLUMN IF NOT EXISTS consensus_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completion_status VARCHAR(50) DEFAULT 'pending' CHECK (completion_status IN ('pending', 'in_progress', 'completed', 'review'));

-- Add worker trust score and stats to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS trust_score DECIMAL(3,2) DEFAULT 1.00 CHECK (trust_score >= 0 AND trust_score <= 1),
ADD COLUMN IF NOT EXISTS tasks_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS honeypot_failed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earned DECIMAL(10,2) DEFAULT 0.00;

-- Add task_seen tracking table for preventing duplicate assignments
CREATE TABLE IF NOT EXISTS task_seen (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, worker_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_reserved_by ON tasks(reserved_by);
CREATE INDEX IF NOT EXISTS idx_tasks_reserved_at ON tasks(reserved_at);
CREATE INDEX IF NOT EXISTS idx_tasks_is_honeypot ON tasks(is_honeypot);
CREATE INDEX IF NOT EXISTS idx_tasks_completion_status ON tasks(completion_status);
CREATE INDEX IF NOT EXISTS idx_users_trust_score ON users(trust_score);
CREATE INDEX IF NOT EXISTS idx_task_seen_task_id ON task_seen(task_id);
CREATE INDEX IF NOT EXISTS idx_task_seen_worker_id ON task_seen(worker_id);

-- Create function to release expired reservations
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS void AS $$
BEGIN
  UPDATE tasks
  SET reserved_by = NULL,
      reserved_at = NULL,
      completion_status = 'pending'
  WHERE reserved_at < NOW() - INTERVAL '30 seconds'
    AND completion_status = 'in_progress';
END;
$$ LANGUAGE plpgsql;

-- Create index for task lookups
CREATE INDEX IF NOT EXISTS idx_tasks_next_task ON tasks(completion_status, reserved_by)
WHERE completion_status = 'pending' AND reserved_by IS NULL;