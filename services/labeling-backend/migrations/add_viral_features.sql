-- Viral Features Migration

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon VARCHAR(100),
  category VARCHAR(50) NOT NULL CHECK (category IN ('milestone', 'streak', 'quality', 'speed', 'social', 'referral')),
  requirement_type VARCHAR(50) NOT NULL,
  requirement_value INTEGER NOT NULL,
  reward_points INTEGER DEFAULT 0,
  reward_labels INTEGER DEFAULT 0,
  is_hidden BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress INTEGER DEFAULT 0,
  shown_to_user BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, achievement_id)
);

-- Create levels table
CREATE TABLE IF NOT EXISTS levels (
  id SERIAL PRIMARY KEY,
  level INTEGER UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  min_points INTEGER NOT NULL,
  max_points INTEGER,
  badge_color VARCHAR(20) DEFAULT '#6366f1',
  bonus_multiplier DECIMAL(3,2) DEFAULT 1.00 CHECK (bonus_multiplier >= 1.00 AND bonus_multiplier <= 3.00),
  rewards JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user streaks table
CREATE TABLE IF NOT EXISTS user_streaks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  total_days_active INTEGER DEFAULT 0,
  consecutive_days INTEGER DEFAULT 0,
  streak_multiplier DECIMAL(3,2) DEFAULT 1.00 CHECK (streak_multiplier >= 1.00 AND streak_multiplier <= 2.00),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily bonuses table
CREATE TABLE IF NOT EXISTS daily_bonuses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  bonus_type VARCHAR(50) NOT NULL,
  bonus_value INTEGER NOT NULL,
  labels_completed INTEGER DEFAULT 0,
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
  UNIQUE(user_id, date, bonus_type)
);

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'first_task', 'converted')),
  reward_given BOOLEAN DEFAULT FALSE,
  reward_amount DECIMAL(10,2) DEFAULT 0.00,
  reward_labels INTEGER DEFAULT 0,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shareable milestones table
CREATE TABLE IF NOT EXISTS shareable_milestones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  milestone_type VARCHAR(50) NOT NULL,
  milestone_value INTEGER NOT NULL,
  message TEXT,
  image_url VARCHAR(500),
  shared_on_twitter BOOLEAN DEFAULT FALSE,
  shared_on_linkedin BOOLEAN DEFAULT FALSE,
  shared_internally BOOLEAN DEFAULT FALSE,
  views_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create viral watermarks table
CREATE TABLE IF NOT EXISTS viral_watermarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  watermark_type VARCHAR(50) DEFAULT 'free_tier',
  display_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leaderboards table (cached for performance)
CREATE TABLE IF NOT EXISTS leaderboards (
  id SERIAL PRIMARY KEY,
  leaderboard_type VARCHAR(50) NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'all_time')),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score DECIMAL(15,2) NOT NULL,
  labels_count INTEGER DEFAULT 0,
  earnings DECIMAL(10,2) DEFAULT 0.00,
  accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(leaderboard_type, period, user_id)
);

-- Create viral events table for tracking
CREATE TABLE IF NOT EXISTS viral_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  reward_given BOOLEAN DEFAULT FALSE,
  reward_type VARCHAR(50),
  reward_value DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default achievements
INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value, reward_points, reward_labels) VALUES
-- Milestone achievements
('First Label', 'Complete your first label', '🎯', 'milestone', 'labels_completed', 1, 10, 5),
('Century Club', 'Complete 100 labels', '💯', 'milestone', 'labels_completed', 100, 100, 50),
('Label Master', 'Complete 1,000 labels', '👑', 'milestone', 'labels_completed', 1000, 500, 200),
('Label Legend', 'Complete 10,000 labels', '🏆', 'milestone', 'labels_completed', 10000, 2000, 1000),

-- Streak achievements
('On Fire', 'Maintain a 7-day streak', '🔥', 'streak', 'streak_days', 7, 50, 25),
('Unstoppable', 'Maintain a 30-day streak', '⚡', 'streak', 'streak_days', 30, 200, 100),
('Immortal', 'Maintain a 100-day streak', '🌟', 'streak', 'streak_days', 100, 1000, 500),

-- Quality achievements
('Perfectionist', 'Achieve 100% accuracy on 100 labels', '🎪', 'quality', 'accuracy_streak', 100, 150, 75),
('Precision Expert', 'Maintain 95%+ accuracy for 1000 labels', '🎖️', 'quality', 'accuracy_volume', 1000, 300, 150),
('Quality King', 'Maintain 98%+ accuracy for 5000 labels', '👑', 'quality', 'accuracy_volume', 5000, 1000, 500),

-- Speed achievements
('Speed Demon', 'Complete 50 labels in one hour', '🚀', 'speed', 'labels_hour', 50, 100, 50),
('Lightning Fast', 'Complete 100 labels in one hour', '⚡', 'speed', 'labels_hour', 100, 200, 100),
('The Flash', 'Complete 500 labels in one day', '💨', 'speed', 'labels_day', 500, 500, 250),

-- Social achievements
('Influencer', 'Share your first achievement', '📢', 'social', 'share_achievement', 1, 50, 25),
('Viral Star', 'Get 100 views on shared milestone', '🌟', 'social', 'milestone_views', 100, 100, 50),
('Community Hero', 'Refer 5 friends who sign up', '🤝', 'social', 'referrals_count', 5, 250, 125),

-- Referral achievements
('Networker', 'Refer your first friend', '👥', 'referral', 'referrals_signup', 1, 100, 50),
('Connector', 'Refer 10 friends', '🌐', 'referral', 'referrals_signup', 10, 500, 250),
('Ambassador', 'Refer 25 friends', '🏅', 'referral', 'referrals_signup', 25, 1500, 750),

ON CONFLICT (name) DO NOTHING;

-- Insert default levels
INSERT INTO levels (level, name, min_points, max_points, badge_color, bonus_multiplier, rewards) VALUES
(1, 'Novice', 0, 99, '#94a3b8', 1.00, '{"daily_bonus": 5}'),
(2, 'Apprentice', 100, 299, '#6366f1', 1.05, '{"daily_bonus": 10, "extra_label": 1}'),
(3, 'Journeyman', 300, 699, '#8b5cf6', 1.10, '{"daily_bonus": 15, "extra_labels": 2}'),
(4, 'Expert', 700, 1499, '#ec4899', 1.15, '{"daily_bonus": 20, "extra_labels": 3, "bonus_multiplier": 1.05}'),
(5, 'Master', 1500, 2999, '#f59e0b', 1.20, '{"daily_bonus": 25, "extra_labels": 5, "bonus_multiplier": 1.10}'),
(6, 'Grandmaster', 3000, 6999, '#ef4444', 1.25, '{"daily_bonus": 30, "extra_labels": 7, "bonus_multiplier": 1.15}'),
(7, 'Legend', 7000, 14999, '#10b981', 1.30, '{"daily_bonus": 40, "extra_labels": 10, "bonus_multiplier": 1.20}'),
(8, 'Mythic', 15000, NULL, '#fbbf24', 1.35, '{"daily_bonus": 50, "extra_labels": 15, "bonus_multiplier": 1.25}'),
ON CONFLICT (level) DO NOTHING;

-- Create functions for viral features

-- Function to check and update user level
CREATE OR REPLACE FUNCTION update_user_level(user_id_param INTEGER)
RETURNS RECORD AS $$
DECLARE
  user_points INTEGER;
  current_level INTEGER;
  new_level RECORD;
BEGIN
  -- Get user total points
  SELECT COALESCE(total_earned, 0) INTO user_points
  FROM users
  WHERE id = user_id_param;

  -- Get current level
  SELECT l.level INTO current_level
  FROM users u
  JOIN levels l ON l.min_points <= u.total_earned AND (l.max_points IS NULL OR u.total_earned <= l.max_points)
  WHERE u.id = user_id_param;

  -- Get new level based on points
  SELECT * INTO new_level
  FROM levels
  WHERE min_points <= user_points AND (max_points IS NULL OR user_points <= max_points)
  ORDER BY level DESC
  LIMIT 1;

  -- Update user if level changed
  IF current_level IS DISTINCT FROM new_level.level THEN
    UPDATE users
    SET level = new_level.level,
        updated_at = NOW()
    WHERE id = user_id_param;

    -- Create level up event
    INSERT INTO viral_events (user_id, event_type, event_data, reward_given, reward_type, reward_value)
    VALUES (
      user_id_param,
      'level_up',
      json_build_object(
        'old_level', current_level,
        'new_level', new_level.level,
        'new_title', new_level.name
      ),
      true,
      'bonus_multiplier',
      new_level.bonus_multiplier
    );
  END IF;

  RETURN new_level;
END;
$$ LANGUAGE plpgsql;

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_achievements(user_id_param INTEGER)
RETURNS TABLE(achievement_name TEXT, points INTEGER) AS $$
DECLARE
  achievement RECORD;
  user_stats RECORD;
  user_achievement RECORD;
BEGIN
  -- Get user stats
  SELECT
    u.*,
    COALESCE(us.current_streak, 0) as streak,
    COALESCE(w.balance, 0) as balance
  INTO user_stats
  FROM users u
  LEFT JOIN user_streaks us ON us.user_id = u.id
  LEFT JOIN wallets w ON w.user_id = u.id
  WHERE u.id = user_id_param;

  -- Check each active achievement
  FOR achievement IN
    SELECT * FROM achievements WHERE is_active = true
  LOOP
    -- Check if already unlocked
    SELECT * INTO user_achievement
    FROM user_achievements
    WHERE user_id = user_id_param AND achievement_id = achievement.id;

    IF user_achievement IS NULL THEN
      -- Check if requirement is met
      IF achievement.requirement_type = 'labels_completed' AND user_stats.tasks_completed >= achievement.requirement_value THEN
        RETURN QUERY SELECT achievement.name, achievement.reward_points;
        PERFORM unlock_achievement(user_id_param, achievement.id);
      ELSIF achievement.requirement_type = 'streak_days' AND user_stats.streak >= achievement.requirement_value THEN
        RETURN QUERY SELECT achievement.name, achievement.reward_points;
        PERFORM unlock_achievement(user_id_param, achievement.id);
      END IF;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to unlock achievement
CREATE OR REPLACE FUNCTION unlock_achievement(user_id_param INTEGER, achievement_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_achievements (user_id, achievement_id, unlocked_at)
  VALUES (user_id_param, achievement_id_param, NOW())
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  -- Update user points and rewards
  UPDATE users
  SET total_earned = total_earned + (
    SELECT reward_points FROM achievements WHERE id = achievement_id_param
  )
  WHERE id = user_id_param;

  -- Add reward labels to wallet
  UPDATE wallets
  SET balance = balance + (
    SELECT COALESCE(reward_labels, 0) FROM achievements WHERE id = achievement_id_param
  )
  WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to update streak
CREATE OR REPLACE FUNCTION update_user_streak(user_id_param INTEGER)
RETURNS DECIMAL AS $$
DECLARE
  current_streak RECORD;
  today DATE := CURRENT_DATE;
  streak_multiplier DECIMAL := 1.00;
BEGIN
  -- Get or create streak record
  INSERT INTO user_streaks (user_id, last_activity_date, current_streak, consecutive_days)
  VALUES (user_id_param, today, 1, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    last_activity_date = EXCLUDED.last_activity_date,
    updated_at = NOW();

  -- Get current streak
  SELECT * INTO current_streak
  FROM user_streaks
  WHERE user_id = user_id_param;

  -- Check if activity is consecutive
  IF current_streak.last_activity_date = today - INTERVAL '1 day' THEN
    -- Continue streak
    UPDATE user_streaks
    SET current_streak = current_streak + 1,
        consecutive_days = consecutive_days + 1,
        longest_streak = GREATEST(longest_streak, current_streak + 1),
        total_days_active = total_days_active + 1
    WHERE user_id = user_id_param;

    -- Calculate streak multiplier
    IF current_streak.current_streak >= 30 THEN
      streak_multiplier := 1.20;
    ELSIF current_streak.current_streak >= 7 THEN
      streak_multiplier := 1.10;
    END IF;
  ELSIF current_streak.last_activity_date < today - INTERVAL '1 day' THEN
    -- Streak broken
    UPDATE user_streaks
    SET current_streak = 1,
        consecutive_days = 1,
        total_days_active = total_days_active + 1
    WHERE user_id = user_id_param;
  END IF;

  RETURN streak_multiplier;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at ON user_achievements(unlocked_at);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_daily_bonuses_user_date ON daily_bonuses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_leaderboards_type_period ON leaderboards(leaderboard_type, period);
CREATE INDEX IF NOT EXISTS idx_leaderboards_score ON leaderboards(score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_events_user_id ON viral_events(user_id);
CREATE INDEX IF NOT EXISTS idx_viral_events_type ON viral_events(event_type);

-- Create views for leaderboards
CREATE OR REPLACE VIEW public_leaderboard AS
SELECT
  u.id as user_id,
  u.username,
  u.first_name,
  u.level,
  l.name as level_name,
  u.tasks_completed,
  u.total_earned,
  u.accuracy_rate,
  COALESCE(us.current_streak, 0) as current_streak,
  COALESCE(ua_count, 0) as achievements_count,
  u.created_at as joined_date
FROM users u
LEFT JOIN levels l ON l.level = u.level
LEFT JOIN user_streaks us ON us.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) as ua_count
  FROM user_achievements
  GROUP BY user_id
) ua_count ON ua_count.user_id = u.id
WHERE u.is_active = true AND u.role = 'worker'
ORDER BY u.total_earned DESC;

-- Trigger for automatic level updates
CREATE OR REPLACE FUNCTION trigger_update_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_earned IS DISTINCT FROM OLD.total_earned THEN
    PERFORM update_user_level(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_level
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_level();

COMMIT;