-- ========================================
-- GDPR Compliance & Audit Logging Schema
-- ========================================

-- Privacy Policy Versions
CREATE TABLE IF NOT EXISTS privacy_policy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Consents
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(100) NOT NULL, -- 'marketing', 'analytics', 'cookies', 'data_processing'
    status VARCHAR(20) NOT NULL CHECK (status IN ('granted', 'denied', 'withdrawn')),
    granted_at TIMESTAMP WITH TIME ZONE,
    withdrawn_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    privacy_policy_version_id UUID REFERENCES privacy_policy_versions(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, consent_type)
);

-- Data Subject Requests (DSAR)
CREATE TABLE IF NOT EXISTS data_subject_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('export', 'deletion', 'rectification', 'portability', 'restriction')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'requires_identity_verification')),
    request_data JSONB DEFAULT '{}',
    response_data JSONB DEFAULT '{}',
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data Processing Records
CREATE TABLE IF NOT EXISTS data_processing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purpose VARCHAR(200) NOT NULL,
    legal_basis VARCHAR(100) NOT NULL, -- 'consent', 'contractual', 'legal_obligation', 'legitimate_interest'
    data_categories TEXT[] NOT NULL, -- ['personal_data', 'contact_info', 'payment_data', 'usage_data']
    retention_period_days INTEGER NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Log Categories
CREATE TYPE audit_category AS ENUM (
    'user_action',
    'data_access',
    'system_change',
    'api_call',
    'admin_action',
    'security_event',
    'compliance_event'
);

-- Audit Log Severities
CREATE TYPE audit_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

-- Comprehensive Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100) NOT NULL UNIQUE,
    category audit_category NOT NULL,
    severity audit_severity NOT NULL DEFAULT 'medium',
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    action VARCHAR(200) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    stack_trace TEXT,
    request_id VARCHAR(100),
    endpoint VARCHAR(500),
    http_method VARCHAR(10),
    response_status INTEGER,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cookie Consents
CREATE TABLE IF NOT EXISTS cookie_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    consent_json JSONB NOT NULL, -- Detailed consent breakdown
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Events Queue
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name VARCHAR(200) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    event_data JSONB DEFAULT '{}',
    user_properties JSONB DEFAULT '{}',
    platform VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- A/B Test Configurations
CREATE TABLE IF NOT EXISTS ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    traffic_percentage INTEGER NOT NULL DEFAULT 100 CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100),
    variants JSONB NOT NULL, -- { "control": { weight: 50 }, "variant_a": { weight: 50 } }
    targeting_rules JSONB DEFAULT '{}',
    success_metrics TEXT[],
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B Test Assignments
CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    variant VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    converted BOOLEAN DEFAULT FALSE,
    converted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(test_id, user_id)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON user_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_id ON audit_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_dsar_user_id ON data_subject_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_dsar_status ON data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_processed ON analytics_events(processed);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_test_id ON ab_test_assignments(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_user_id ON ab_test_assignments(user_id);

-- Partition Audit Logs by Month (Optional for high volume)
-- Uncomment if you expect high audit log volume
-- CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Functions and Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_privacy_policy_versions_updated_at BEFORE UPDATE ON privacy_policy_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_consents_updated_at BEFORE UPDATE ON user_consents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_subject_requests_updated_at BEFORE UPDATE ON data_subject_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_processing_records_updated_at BEFORE UPDATE ON data_processing_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cookie_consents_updated_at BEFORE UPDATE ON cookie_consents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ab_tests_updated_at BEFORE UPDATE ON ab_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique event IDs
CREATE OR REPLACE FUNCTION generate_audit_event_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.event_id = concat('audit_', extract(epoch from now())::bigint, '_', random()::text);
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generate_audit_event_id_trigger BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION generate_audit_event_id();

-- Insert initial privacy policy version
INSERT INTO privacy_policy_versions (version, content, effective_date, is_current)
VALUES (
    '1.0',
    '# Privacy Policy

## Data We Collect
- Personal identification information
- Usage data and analytics
- Payment information
- Communication data

## How We Use Your Data
- Provide our services
- Improve user experience
- Send important notifications
- Legal compliance

## Your Rights
- Right to access your data
- Right to deletion
- Right to data portability
- Right to consent withdrawal

## Contact Us
For privacy inquiries, contact privacy@deligate.it',
    NOW(),
    true
) ON CONFLICT (version) DO NOTHING;

-- Create default data processing records
INSERT INTO data_processing_records (purpose, legal_basis, data_categories, retention_period_days)
VALUES
    ('User Authentication', 'contractual', ARRAY['personal_data', 'authentication_data'], 2555), -- 7 years
    ('Service Delivery', 'contractual', ARRAY['personal_data', 'usage_data', 'performance_data'], 1825), -- 5 years
    ('Analytics', 'legitimate_interest', ARRAY['usage_data', 'device_data', 'behavioral_data'], 730), -- 2 years
    ('Marketing', 'consent', ARRAY['contact_info', 'preferences_data'], 1095), -- 3 years
    ('Legal Compliance', 'legal_obligation', ARRAY['transaction_data', 'communication_data'], 3650) -- 10 years
ON CONFLICT DO NOTHING;