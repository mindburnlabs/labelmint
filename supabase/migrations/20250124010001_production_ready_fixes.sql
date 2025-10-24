-- Migration: Production-Ready Fixes
-- Addresses additional production requirements

-- 1. Add missing columns for TON integration
DO $$
BEGIN
    -- Add ton_balance and usdt_balance to users table if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'ton_balance'
    ) THEN
        ALTER TABLE users ADD COLUMN ton_balance DECIMAL(20,9) DEFAULT 0;
        ALTER TABLE users ADD COLUMN usdt_balance DECIMAL(20,6) DEFAULT 0;
        ALTER TABLE users ADD COLUMN ton_wallet_address VARCHAR(100);
    END IF;

    -- Add missing columns to projects table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'budget'
    ) THEN
        ALTER TABLE projects ADD COLUMN budget DECIMAL(20,6) DEFAULT 0;
        ALTER TABLE projects ADD COLUMN budget_remaining DECIMAL(20,6) DEFAULT 0;
    END IF;

    -- Add missing columns to tasks table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE tasks ADD COLUMN assigned_to UUID REFERENCES users(id);
        ALTER TABLE tasks ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 1;
    END IF;
END $$;

-- 2. Create task_answers table if it doesn't exist
CREATE TABLE IF NOT EXISTS task_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answer JSONB NOT NULL,
    time_spent INTEGER, -- Time in seconds
    is_correct BOOLEAN DEFAULT FALSE,
    earnings DECIMAL(20,6) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, worker_id)
);

-- 3. Create workflow tables if they don't exist
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    definition JSONB NOT NULL DEFAULT '{}',
    variables JSONB DEFAULT '[]',
    settings JSONB DEFAULT '{}',
    triggers JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    category VARCHAR(100),
    created_by UUID REFERENCES users(id),
    organization_id UUID,
    team_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    organization_id UUID,
    triggered_by VARCHAR(255),
    triggered_by_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    context JSONB DEFAULT '{}',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- Duration in milliseconds
    node_id VARCHAR(255),
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL,
    node_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    error TEXT,
    retries INTEGER DEFAULT 0
);

-- 4. Add additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_answers_worker_correct ON task_answers(worker_id, is_correct);
CREATE INDEX IF NOT EXISTS idx_task_answers_task_correct ON task_answers(task_id, is_correct);
CREATE INDEX IF NOT EXISTS idx_task_answers_created ON task_answers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflows_org ON workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_org ON workflow_executions(organization_id);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_execution ON workflow_tasks(execution_id, start_time);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_status ON workflow_tasks(status, start_time DESC);

-- 5. Add audit log table for security compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_resource ON audit_logs(action, resource_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(created_at DESC);

-- 6. Add rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    request_count INTEGER DEFAULT 1,
    limit_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(identifier, window_start, window_end)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_window ON rate_limits(identifier, window_start, window_end);

-- 7. Add API usage tracking table
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER, -- Response time in milliseconds
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    request_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage(user_id, request_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_status ON api_usage(status_code);

-- 8. Create triggers for audit logging
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values
    ) VALUES (
        COALESCE(current_setting('app.current_user_id', true)::UUID, NULL),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers to sensitive tables
DO $$
BEGIN
    -- Users table
    DROP TRIGGER IF EXISTS audit_users_trigger ON users;
    CREATE TRIGGER audit_users_trigger
        AFTER INSERT OR UPDATE OR DELETE ON users
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();

    -- Projects table
    DROP TRIGGER IF EXISTS audit_projects_trigger ON projects;
    CREATE TRIGGER audit_projects_trigger
        AFTER INSERT OR UPDATE OR DELETE ON projects
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();

    -- Transactions table
    DROP TRIGGER IF EXISTS audit_transactions_trigger ON transactions;
    CREATE TRIGGER audit_transactions_trigger
        AFTER INSERT OR UPDATE OR DELETE ON transactions
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();

    -- Withdrawals table
    DROP TRIGGER IF EXISTS audit_withdrawals_trigger ON withdrawals;
    CREATE TRIGGER audit_withdrawals_trigger
        AFTER INSERT OR UPDATE OR DELETE ON withdrawals
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
END $$;

-- 9. Add updated_at triggers to new tables
DO $$
BEGIN
    -- task_answers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_answers') THEN
        DROP TRIGGER IF EXISTS update_task_answers_updated_at ON task_answers;
        CREATE TRIGGER update_task_answers_updated_at
            BEFORE UPDATE ON task_answers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- workflows
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflows') THEN
        DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
        CREATE TRIGGER update_workflows_updated_at
            BEFORE UPDATE ON workflows
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- workflow_executions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_executions') THEN
        DROP TRIGGER IF EXISTS update_workflow_executions_updated_at ON workflow_executions;
        CREATE TRIGGER update_workflow_executions_updated_at
            BEFORE UPDATE ON workflow_executions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- rate_limits
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_limits') THEN
        DROP TRIGGER IF EXISTS update_rate_limits_updated_at ON rate_limits;
        CREATE TRIGGER update_rate_limits_updated_at
            BEFORE UPDATE ON rate_limits
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 10. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON task_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON workflows TO authenticated;
GRANT SELECT, INSERT ON workflow_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON workflow_tasks TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON api_usage TO authenticated;

-- 11. Create RLS policies for new tables
ALTER TABLE task_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Task answers - users can see their own, admins can see all
CREATE POLICY "Workers can view own task answers" ON task_answers
    FOR SELECT USING (worker_id = auth.uid());

CREATE POLICY "Admins can view all task answers" ON task_answers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Workflow executions - organization-based access
CREATE POLICY "Users can view own workflow executions" ON workflow_executions
    FOR SELECT USING (
        organization_id IS NULL OR
        organization_id IN (
            SELECT organization_id FROM user_organizations
            WHERE user_id = auth.uid()
        )
    );

-- 12. Add constraints
ALTER TABLE task_answers ADD CONSTRAINT check_earnings_non_negative
    CHECK (earnings >= 0);

ALTER TABLE tasks ADD CONSTRAINT check_priority_range
    CHECK (priority BETWEEN 1 AND 5);

ALTER TABLE workflows ADD CONSTRAINT check_version_positive
    CHECK (version > 0);

-- 13. Create materialized view for dashboard stats
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
    (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
    (SELECT COUNT(*) FROM tasks WHERE status = 'pending') as pending_tasks,
    (SELECT COUNT(*) FROM tasks WHERE status = 'completed') as completed_tasks,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed') as total_transactions,
    (SELECT COALESCE(SUM(earnings), 0) FROM task_answers WHERE is_correct = true) as total_earnings,
    NOW() as last_updated;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_unique ON dashboard_stats (last_updated);

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh (requires pg_cron extension)
-- SELECT cron.schedule('refresh-dashboard', '*/5 * * * *', 'SELECT refresh_dashboard_stats();');

COMMENT ON MATERIALIZED VIEW dashboard_stats IS 'Precomputed dashboard statistics for quick loading';

-- Final validation
SELECT
    'Production-ready migration completed' as status,
    NOW() as completed_at,
    COUNT(*) as total_tables_created
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN (
        'task_answers', 'workflows', 'workflow_executions',
        'workflow_tasks', 'audit_logs', 'rate_limits', 'api_usage'
    );