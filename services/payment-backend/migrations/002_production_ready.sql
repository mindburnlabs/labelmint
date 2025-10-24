-- Production-Ready Database Schema
-- This migration ensures all tables are optimized for production workloads

-- Enhanced Users Table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip INET;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Delegates Table
CREATE TABLE IF NOT EXISTS delegates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    daily_limit NUMERIC(20,6) DEFAULT 100.00,
    weekly_limit NUMERIC(20,6) DEFAULT 700.00,
    monthly_limit NUMERIC(20,6) DEFAULT 3000.00,
    per_task_limit NUMERIC(20,6) DEFAULT 50.00,
    total_spent NUMERIC(20,6) DEFAULT 0.000000,
    allowed_actions TEXT[] DEFAULT ARRAY['view_tasks'],
    suspension_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT unique_delegate_user UNIQUE (user_id, owner_id)
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'active', 'suspended', 'completed', 'rejected', 'featured')),
    consensus_type VARCHAR(20) NOT NULL DEFAULT '2_3' CHECK (consensus_type IN ('none', '2_3', '3_3')),
    consensus_threshold INTEGER DEFAULT 2,
    quality_control_enabled BOOLEAN DEFAULT true,
    honeypot_enabled BOOLEAN DEFAULT false,
    auto_assign_enabled BOOLEAN DEFAULT true,
    featured_priority INTEGER DEFAULT 0 CHECK (featured_priority >= 0 AND featured_priority <= 10),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Members
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    permissions TEXT[] DEFAULT ARRAY['view'],
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_project_member UNIQUE (project_id, user_id)
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    batch_id UUID,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    data JSONB NOT NULL,
    instructions TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'skipped', 'expired')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    consensus_required INTEGER DEFAULT 3,
    current_submissions INTEGER DEFAULT 0,
    payment_amount NUMERIC(20,6),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Submissions
CREATE TABLE IF NOT EXISTS task_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label_data JSONB NOT NULL,
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    time_spent_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    is_consensus_participant BOOLEAN DEFAULT false,
    quality_score NUMERIC(3,2),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_task_submission UNIQUE (task_id, user_id)
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Activity Log
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Usage Tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    request_size INTEGER DEFAULT 0,
    response_size INTEGER DEFAULT 0,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Verifications
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email_verification', 'password_reset')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Worker Stats
CREATE TABLE IF NOT EXISTS worker_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tasks_completed INTEGER DEFAULT 0,
    avg_completion_time_ms INTEGER,
    quality_score NUMERIC(3,2) DEFAULT 0.00,
    total_earned NUMERIC(20,6) DEFAULT 0.000000,
    last_earned_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_worker_stat UNIQUE (user_id)
);

-- Quality Metrics
CREATE TABLE IF NOT EXISTS quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES task_submissions(id) ON DELETE SET NULL,
    consensus_score NUMERIC(3,2),
    accuracy_score NUMERIC(3,2),
    speed_score NUMERIC(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Worker Payouts
CREATE TABLE IF NOT EXISTS worker_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    batch_id UUID,
    amount NUMERIC(20,6) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USDT',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    tx_hash VARCHAR(66),
    fee NUMERIC(20,6) DEFAULT 0.000000,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Performance optimized indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_featured ON projects(featured_priority DESC, status) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_expires ON tasks(expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_task ON task_submissions(task_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_user ON task_submissions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_key_usage ON api_usage(api_key_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_endpoint ON api_usage(endpoint, created_at DESC);

-- Row Level Security Policies (PostgreSQL)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see/update their own data
CREATE POLICY users_isolation ON users
    FOR ALL TO authenticated_user
    USING (id = current_user_id())
    WITH CHECK (id = current_user_id());

-- Project members can see projects they're members of
CREATE POLICY projects_member_access ON projects
    FOR SELECT TO authenticated_user
    USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = projects.id
            AND pm.user_id = current_user_id()
        )
    );

-- Task access based on project membership
CREATE POLICY tasks_member_access ON tasks
    FOR SELECT TO authenticated_user
    USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = tasks.project_id
            AND pm.user_id = current_user_id()
        )
    );

-- Notifications are user-specific
CREATE POLICY notifications_isolation ON notifications
    FOR ALL TO authenticated_user
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id());