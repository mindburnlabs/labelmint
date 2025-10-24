-- Growth Automation System Migration

-- Create leads table for tracking potential customers
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  company VARCHAR(255),
  source VARCHAR(100) NOT NULL, -- twitter, reddit, cold_email, organic, referral
  source_details JSONB, -- Additional data about lead source
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'responded', 'trial', 'converted', 'unqualified')),
  lead_score INTEGER DEFAULT 0, -- 0-100 scoring based on signals
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_contact_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE
);

-- Create campaigns table for tracking marketing campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL, -- twitter, reddit, email, social_ads
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  settings JSONB NOT NULL, -- Campaign-specific settings
  metrics JSONB DEFAULT '{}', -- Performance metrics
  start_date DATE NOT NULL,
  end_date DATE,
  daily_limit INTEGER DEFAULT 50, -- Daily contact limit
  total_sent INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create social engagements table
CREATE TABLE IF NOT EXISTS social_engagements (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL, -- twitter, reddit, linkedin
  platform_id VARCHAR(255) NOT NULL, -- Tweet ID, Reddit post ID, etc.
  author_handle VARCHAR(255),
  author_followers INTEGER,
  content TEXT NOT NULL,
  keywords_matched TEXT[],
  our_reply TEXT,
  reply_id VARCHAR(255), -- ID of our reply
  status VARCHAR(50) DEFAULT 'identified' CHECK (status IN ('identified', 'replied', 'responded', 'hot_lead', 'not_interested')),
  lead_id INTEGER REFERENCES leads(id),
  engagement_data JSONB, -- Likes, retweets, comments, etc.
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  replied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email sequences for automated nurturing
CREATE TABLE IF NOT EXISTS email_sequences (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  sequence_step INTEGER DEFAULT 1,
  template_name VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  content TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'opened', 'clicked', 'replied', 'bounced', 'failed')),
  metadata JSONB
);

-- Create free tier tracking
CREATE TABLE IF NOT EXISTS free_tier_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  free_labels_remaining INTEGER DEFAULT 100,
  free_labels_used INTEGER DEFAULT 0,
  trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trial_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  conversion_emails_sent INTEGER DEFAULT 0,
  last_conversion_email_at TIMESTAMP WITH TIME ZONE,
  converted_to_paid BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMP WITH TIME ZONE,
  initial_campaign_source VARCHAR(100), -- Which campaign brought them in
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL, -- lead_created, campaign_start, email_sent, conversion
  user_id INTEGER REFERENCES users(id),
  lead_id INTEGER REFERENCES leads(id),
  campaign_id INTEGER REFERENCES campaigns(id),
  properties JSONB NOT NULL, -- Event-specific data
  ip_address INET,
  user_agent TEXT,
  referrer VARCHAR(500),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Twitter monitoring queue
CREATE TABLE IF NOT EXISTS twitter_monitoring_queue (
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(500) NOT NULL,
  last_tweet_id VARCHAR(255), -- For pagination
  status VARCHAR(50) DEFAULT 'active',
  matches_found INTEGER DEFAULT 0,
  replies_sent INTEGER DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scraped companies table from Crunchbase
CREATE TABLE IF NOT EXISTS scraped_companies (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  description TEXT,
  industry VARCHAR(100),
  founded_year INTEGER,
  employee_count VARCHAR(100),
  funding_stage VARCHAR(100),
  total_funding DECIMAL(15,2),
  contacts JSONB, -- Emails, names found
  scraped_from VARCHAR(100) DEFAULT 'crunchbase',
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_verified TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'responded', 'do_not_contact'))
);

-- Create automated reply templates
CREATE TABLE IF NOT EXISTS reply_templates (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  template_type VARCHAR(100) NOT NULL, -- help_offer, resource_share, expert_offer
  keywords TEXT[] NOT NULL,
  template_content TEXT NOT NULL,
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default reply templates
INSERT INTO reply_templates (platform, template_type, keywords, template_content) VALUES
('twitter', 'help_offer', ARRAY['need labeled data', 'looking for data labelers', 'need data annotation'],
  'Hey! We noticed you need labeled data. Our platform provides AI-assisted labeling with 99%+ accuracy. We can get you started with 100 free labels. Check us out: https://deligate.it'),

('twitter', 'resource_share', ARRAY['how to label data', 'data labeling tools', 'annotation help'],
  'Struggling with data labeling? We wrote a comprehensive guide on AI-assisted labeling that saves 40% on costs. Plus, get 100 free labels to try it out: https://deligate.it/blog/ai-labeling-guide'),

('twitter', 'expert_offer', ARRAY['ml dataset', 'training data', 'ai model training'],
  'Building ML models? Quality training data is crucial. Our platform combines human expertise with AI to deliver perfect datasets. First 100 labels on us: https://deligate.it'),

('reddit', 'helpful_dm', ARRAY['dataset', 'labeling', 'annotation'],
  'Hi! Saw your post about needing labeled data. I''m from deligate.it - we help AI companies get high-quality training data. Would you be interested in 100 free labels to test our platform? No credit card required.'),

('email', 'cold_outreach', ARRAY[''],
  'Hi {{name}},\n\nI noticed {{company}} is working in the AI space. Getting quality labeled data is often the biggest bottleneck in ML development.\n\nOur platform at deligate.it uses AI to reduce labeling costs by 40% while maintaining 99%+ accuracy. We''re offering 100 free labels for you to see the quality difference.\n\nWould you be open to a quick 15-minute demo next week?\n\nBest regards\nGrowth Team @ deligate.it');

-- Create functions for lead scoring
CREATE OR REPLACE FUNCTION calculate_lead_score(lead_id_param INTEGER)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  lead_info RECORD;
BEGIN
  SELECT * INTO lead_info FROM leads WHERE id = lead_id_param;

  -- Base score based on source
  CASE lead_info.source
    WHEN 'twitter' THEN score := score + 20;
    WHEN 'reddit' THEN score := score + 25;
    WHEN 'cold_email' THEN score := score + 10;
    WHEN 'referral' THEN score := score + 30;
  END CASE;

  -- Add score based on company info
  IF lead_info.source_details->>'company_size' = 'startup' THEN score := score + 10;
  END IF;

  IF lead_info.source_details->>'has_ai_terms' = 'true' THEN score := score + 15;
  END IF;

  IF lead_info.source_details->>'follower_count'::INTEGER > 1000 THEN score := score + 5;
  END IF;

  -- Update score
  UPDATE leads SET lead_score = score WHERE id = lead_id_param;

  RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Create function to update free tier usage
CREATE OR REPLACE FUNCTION update_free_tier_usage(user_id_param INTEGER, labels_used INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  free_tier_info RECORD;
BEGIN
  SELECT * INTO free_tier_info FROM free_tier_accounts WHERE user_id = user_id_param;

  IF NOT FOUND THEN
    INSERT INTO free_tier_accounts (user_id, free_labels_used)
    VALUES (user_id_param, labels_used);
    RETURN TRUE;
  END IF;

  IF free_tier_info.free_labels_remaining >= labels_used THEN
    UPDATE free_tier_accounts
    SET free_labels_used = free_labels_used + labels_used,
        free_labels_remaining = free_labels_remaining - labels_used,
        updated_at = NOW()
    WHERE user_id = user_id_param;

    -- Send conversion email if less than 20 labels remaining
    IF free_tier_info.free_labels_remaining - labels_used <= 20
       AND free_tier_info.conversion_emails_sent = 0 THEN
      -- Trigger conversion email
      PERFORM send_conversion_email(user_id_param);
      UPDATE free_tier_accounts
      SET conversion_emails_sent = 1,
          last_conversion_email_at = NOW()
      WHERE user_id = user_id_param;
    END IF;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_social_engagements_platform ON social_engagements(platform, status);
CREATE INDEX IF NOT EXISTS idx_social_engagements_scraped_at ON social_engagements(scraped_at);
CREATE INDEX IF NOT EXISTS idx_email_sequences_scheduled_at ON email_sequences(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_free_tier_user_id ON free_tier_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- Create view for campaign performance
CREATE OR REPLACE VIEW campaign_performance AS
SELECT
  c.id,
  c.name,
  c.type,
  c.status,
  c.total_sent,
  c.total_responses,
  CASE WHEN c.total_sent > 0 THEN ROUND((c.total_responses::DECIMAL / c.total_sent) * 100, 2) ELSE 0 END as response_rate,
  CASE WHEN c.total_sent > 0 THEN ROUND((c.total_converted::DECIMAL / c.total_sent) * 100, 2) ELSE 0 END as conversion_rate,
  c.start_date,
  c.days_active := CURRENT_DATE - c.start_date
FROM campaigns c;

-- Create view for lead funnel
CREATE OR REPLACE VIEW lead_funnel AS
SELECT
  COUNT(*) FILTER (WHERE status = 'new') as new_leads,
  COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
  COUNT(*) FILTER (WHERE status = 'responded') as responded,
  COUNT(*) FILTER (WHERE status = 'trial') as in_trial,
  COUNT(*) FILTER (WHERE status = 'converted') as converted,
  COUNT(*) as total_leads,
  AVG(lead_score) as avg_score
FROM leads
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Create trigger functions
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER trigger_update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

CREATE TRIGGER trigger_update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

COMMIT;