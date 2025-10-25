-- ============================================================================
-- DATABASE SECURITY HARDENING FOR LABELMINT PRODUCTION
-- ============================================================================

-- Set statement timeout for safety
SET statement_timeout = '300s';

-- ============================================================================
-- SSL/TLS CONFIGURATION VALIDATION
-- ============================================================================

-- Enable SSL for all connections (requires server restart)
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/etc/ssl/certs/postgresql.crt';
ALTER SYSTEM SET ssl_key_file = '/etc/ssl/private/postgresql.key';
ALTER SYSTEM SET ssl_ca_file = '/etc/ssl/certs/ca.crt';
ALTER SYSTEM SET ssl_crl_file = '/etc/ssl/certs/server.crl';
ALTER SYSTEM SET ssl_min_protocol_version = 'TLSv1.2';
ALTER SYSTEM SET ssl_prefer_server_ciphers = on;
ALTER SYSTEM SET ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL:!SSLv2:!SSLv3';

-- Require SSL for all connections
ALTER SYSTEM SET ssl = on;

-- ============================================================================
-- SECURE USER AND ROLE MANAGEMENT
-- ============================================================================

-- Create secure application roles with minimal privileges
DO $$
BEGIN
    -- Read-only role for analytics
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'labelmint_readonly') THEN
        CREATE ROLE labelmint_readonly WITH NOLOGIN NOINHERIT;
    END IF;

    -- Read-write role for applications
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'labelmint_app') THEN
        CREATE ROLE labelmint_app WITH NOLOGIN NOINHERIT;
    END IF;

    -- Admin role for database administration
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'labelmint_admin') THEN
        CREATE ROLE labelmint_admin WITH NOLOGIN NOINHERIT;
    END IF;

    -- Analytics role with limited access
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'labelmint_analytics') THEN
        CREATE ROLE labelmint_analytics WITH NOLOGIN NOINHERIT;
    END IF;

    -- Backup role
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'labelmint_backup') THEN
        CREATE ROLE labelmint_backup WITH NOLOGIN NOINHERIT;
    END IF;
END $$;

-- Grant appropriate privileges to roles
GRANT CONNECT ON DATABASE labelmint TO labelmint_readonly;
GRANT CONNECT ON DATABASE labelmint TO labelmint_app;
GRANT CONNECT ON DATABASE labelmint TO labelmint_admin;
GRANT CONNECT ON DATABASE labelmint TO labelmint_analytics;
GRANT CONNECT ON DATABASE labelmint TO labelmint_backup;

-- USAGE on public schema
GRANT USAGE ON SCHEMA public TO labelmint_readonly;
GRANT USAGE ON SCHEMA public TO labelmint_app;
GRANT USAGE ON SCHEMA public TO labelmint_admin;
GRANT USAGE ON SCHEMA public TO labelmint_analytics;
GRANT USAGE ON SCHEMA public TO labelmint_backup;

-- Read-only grants
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('GRANT SELECT ON TABLE %I.%I TO labelmint_readonly',
                      table_record.table_schema, table_record.table_name);
        EXECUTE format('GRANT SELECT ON TABLE %I.%I TO labelmint_analytics',
                      table_record.table_schema, table_record.table_name);
    END LOOP;
END $$;

-- Read-write grants for application tables
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('pg_stat_statements', 'pg_stat_statements_info')
    LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO labelmint_app',
                      table_record.table_schema, table_record.table_name);
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I.%I TO labelmint_app',
                      table_record.table_schema,
                      replace(table_record.table_name || '_seq', '_id_seq', '_id_seq'));
    END LOOP;
END $$;

-- Admin grants
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO labelmint_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO labelmint_admin;
GRANT CREATE ON SCHEMA public TO labelmint_admin;

-- Backup grants
GRANT SELECT ON ALL TABLES IN SCHEMA public TO labelmint_backup;

-- ============================================================================
-- SECURE APPLICATION USERS
-- ============================================================================

-- Create secure application users
DO $$
BEGIN
    -- Web application user
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'labelmint_web') THEN
        CREATE USER labelmint_web WITH
            PASSWORD 'CHANGE_ME_WEB_PASSWORD'
            NOINHERIT
            CONNECTION LIMIT 50
            VALID UNTIL '2025-12-31';
        GRANT labelmint_app TO labelmint_web;
    END IF;

    -- API gateway user
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'labelmint_api') THEN
        CREATE USER labelmint_api WITH
            PASSWORD 'CHANGE_ME_API_PASSWORD'
            NOINHERIT
            CONNECTION LIMIT 100
            VALID UNTIL '2025-12-31';
        GRANT labelmint_app TO labelmint_api;
    END IF;

    -- Analytics user
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'labelmint_analytics_user') THEN
        CREATE USER labelmint_analytics_user WITH
            PASSWORD 'CHANGE_ME_ANALYTICS_PASSWORD'
            NOINHERIT
            CONNECTION LIMIT 10
            VALID UNTIL '2025-12-31';
        GRANT labelmint_analytics TO labelmint_analytics_user;
    END IF;

    -- Backup user
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'labelmint_backup_user') THEN
        CREATE USER labelmint_backup_user WITH
            PASSWORD 'CHANGE_ME_BACKUP_PASSWORD'
            NOINHERIT
            CONNECTION LIMIT 5
            VALID UNTIL '2025-12-31';
        GRANT labelmint_backup TO labelmint_backup_user;
    END IF;
END $$;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) IMPLEMENTATION
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_crypto_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;

-- Create security policies for users table
DROP POLICY IF EXISTS users_self_policy ON users;
CREATE POLICY users_self_policy ON users
    FOR ALL
    TO labelmint_app
    USING (id = current_setting('app.current_user_id', true)::uuid OR
           current_setting('app.is_admin', true)::boolean = true);

-- Security policy for wallets table
DROP POLICY IF EXISTS wallets_self_policy ON wallets;
CREATE POLICY wallets_self_policy ON wallets
    FOR ALL
    TO labelmint_app
    USING (user_id = current_setting('app.current_user_id', true)::uuid OR
           current_setting('app.is_admin', true)::boolean = true);

-- Security policy for transactions table
DROP POLICY IF EXISTS transactions_self_policy ON transactions;
CREATE POLICY transactions_self_policy ON transactions
    FOR ALL
    TO labelmint_app
    USING (user_id = current_setting('app.current_user_id', true)::uuid OR
           current_setting('app.is_admin', true)::boolean = true);

-- Security policy for withdrawals table
DROP POLICY IF EXISTS withdrawals_self_policy ON withdrawals;
CREATE POLICY withdrawals_self_policy ON withdrawals
    FOR ALL
    TO labelmint_app
    USING (user_id = current_setting('app.current_user_id', true)::uuid OR
           current_setting('app.is_admin', true)::boolean = true);

-- Read-only policy for analytics users
DROP POLICY IF EXISTS users_analytics_policy ON users;
CREATE POLICY users_analytics_policy ON users
    FOR SELECT
    TO labelmint_analytics
    USING (is_active = true AND
           created_at > now() - interval '2 years');

-- ============================================================================
-- COLUMN-LEVEL SECURITY
-- ============================================================================

-- Create secure views for sensitive data with limited columns
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
    id,
    telegram_id,
    COALESCE(first_name, 'Anonymous') as first_name,
    COALESCE(last_name, '') as last_name,
    username,
    is_active,
    role,
    level,
    experience_points,
    current_streak,
    max_streak,
    tasks_completed,
    accuracy_rate,
    trust_score,
    created_at,
    updated_at
FROM users
WHERE is_active = true;

-- Grant access to secure view
GRANT SELECT ON user_profiles TO labelmint_readonly;
GRANT SELECT ON user_profiles TO labelmint_analytics;
GRANT SELECT ON user_profiles TO labelmint_app;

-- Create secure financial transactions view
CREATE OR REPLACE VIEW public.transaction_summary AS
SELECT
    id,
    user_id,
    amount,
    currency,
    type,
    status,
    created_at,
    completed_at
FROM transactions
WHERE status = 'COMPLETED'
  AND created_at > now() - interval '1 year';

-- Grant access to transaction summary
GRANT SELECT ON transaction_summary TO labelmint_analytics;
GRANT SELECT ON transaction_summary TO labelmint_readonly;

-- ============================================================================
-- AUDITING AND LOGGING
-- ============================================================================

-- Create audit table for sensitive operations
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    user_id UUID,
    user_role VARCHAR(50),
    old_values JSONB,
    new_values JSONB,
    query_text TEXT,
    client_ip INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    transaction_id BIGINT
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_operation ON audit_log(table_name, operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id, timestamp DESC);

-- Grant access to audit log
GRANT SELECT ON audit_log TO labelmint_admin;
GRANT INSERT ON audit_log TO labelmint_app;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        table_name,
        operation,
        user_id,
        user_role,
        old_values,
        new_values,
        query_text,
        client_ip,
        user_agent,
        transaction_id
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        current_setting('app.current_user_id', true)::uuid,
        current_setting('app.current_user_role', true),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        current_query(),
        inet_client_addr(),
        current_setting('app.user_agent', true),
        txid_current()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
DO $$
BEGIN
    -- Users table
    DROP TRIGGER IF EXISTS users_audit_trigger ON users;
    CREATE TRIGGER users_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON users
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

    -- Wallets table
    DROP TRIGGER IF EXISTS wallets_audit_trigger ON wallets;
    CREATE TRIGGER wallets_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON wallets
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

    -- Transactions table
    DROP TRIGGER IF EXISTS transactions_audit_trigger ON transactions;
    CREATE TRIGGER transactions_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON transactions
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

    -- Withdrawals table
    DROP TRIGGER IF EXISTS withdrawals_audit_trigger ON withdrawals;
    CREATE TRIGGER withdrawals_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON withdrawals
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
END $$;

-- ============================================================================
-- CONNECTION SECURITY
-- ============================================================================

-- Create function to log connection attempts
CREATE OR REPLACE FUNCTION log_connection()
RETURNS void AS $$
BEGIN
    INSERT INTO audit_log (
        table_name,
        operation,
        user_id,
        user_role,
        client_ip,
        user_agent,
        timestamp
    ) VALUES (
        'connection',
        'LOGIN',
        current_setting('app.current_user_id', true)::uuid,
        current_setting('app.current_user_role', true),
        inet_client_addr(),
        current_setting('app.user_agent', true),
        NOW()
    );
EXCEPTION WHEN OTHERS THEN
    -- Don't fail login due to logging errors
    NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ENCRYPTION AND SENSITIVE DATA PROTECTION
-- ============================================================================

-- Enable pgcrypto extension for data encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption functions
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(encrypt(data::bytea, key::bytea, 'aes'), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN convert_from(decrypt(decode(encrypted_data, 'base64'), key::bytea, 'aes'), 'UTF8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view to mask sensitive data for non-admin users
CREATE OR REPLACE VIEW public.users_masked AS
SELECT
    id,
    telegram_id,
    first_name,
    last_name,
    username,
    is_active,
    role,
    level,
    experience_points,
    tasks_completed,
    accuracy_rate,
    trust_score,
    created_at,
    updated_at,
    -- Mask sensitive financial data
    CASE
        WHEN current_setting('app.is_admin', true)::boolean = true THEN wallet_balance
        ELSE NULL
    END as wallet_balance,
    CASE
        WHEN current_setting('app.is_admin', true)::boolean = true THEN total_earned
        ELSE NULL
    END as total_earned,
    CASE
        WHEN current_setting('app.is_admin', true)::boolean = true THEN ton_wallet_address
        ELSE NULL
    END as ton_wallet_address
FROM users;

-- Grant access to masked view
GRANT SELECT ON users_masked TO labelmint_readonly;
GRANT SELECT ON users_masked TO labelmint_analytics;

-- ============================================================================
-- SECURITY MONITORING VIEWS
-- ============================================================================

-- View for monitoring failed login attempts
CREATE OR REPLACE VIEW security.failed_logins AS
SELECT
    timestamp,
    user_id,
    user_role,
    client_ip,
    user_agent,
    COUNT(*) as attempt_count
FROM audit_log
WHERE table_name = 'connection'
  AND operation = 'LOGIN'
  AND timestamp > now() - interval '24 hours'
GROUP BY timestamp, user_id, user_role, client_ip, user_agent
ORDER BY timestamp DESC;

-- View for monitoring sensitive data access
CREATE OR REPLACE VIEW security.sensitive_data_access AS
SELECT
    timestamp,
    table_name,
    operation,
    user_id,
    user_role,
    client_ip,
    CASE
        WHEN operation = 'UPDATE' AND (table_name IN ('users', 'wallets', 'transactions')) THEN 'HIGH'
        WHEN operation = 'DELETE' THEN 'HIGH'
        WHEN operation = 'INSERT' AND (table_name IN ('transactions', 'withdrawals')) THEN 'MEDIUM'
        ELSE 'LOW'
    END as risk_level
FROM audit_log
WHERE table_name IN ('users', 'wallets', 'transactions', 'withdrawals', 'user_crypto_wallets', 'bank_details')
  AND timestamp > now() - interval '24 hours'
ORDER BY timestamp DESC;

-- View for unusual activity patterns
CREATE OR REPLACE VIEW security.unusual_activity AS
SELECT
    user_id,
    user_role,
    COUNT(*) as operation_count,
    COUNT(DISTINCT table_name) as tables_accessed,
    MIN(timestamp) as first_access,
    MAX(timestamp) as last_access,
    CASE
        WHEN COUNT(*) > 1000 THEN 'VERY HIGH'
        WHEN COUNT(*) > 500 THEN 'HIGH'
        WHEN COUNT(*) > 100 THEN 'MEDIUM'
        ELSE 'NORMAL'
    END as activity_level
FROM audit_log
WHERE timestamp > now() - interval '1 hour'
  AND table_name NOT IN ('connection')
GROUP BY user_id, user_role
HAVING COUNT(*) > 50
ORDER BY operation_count DESC;

-- ============================================================================
-- SECURITY VALIDATION FUNCTIONS
-- ============================================================================

-- Function to validate security configuration
CREATE OR REPLACE FUNCTION validate_security_configuration()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    RETURN QUERY

    -- Check if SSL is enabled
    SELECT
        'SSL Configuration',
        CASE WHEN current_setting('ssl')::boolean THEN 'PASS' ELSE 'FAIL' END,
        'SSL is ' || CASE WHEN current_setting('ssl')::boolean THEN 'enabled' ELSE 'disabled' END

    UNION ALL

    -- Check if RLS is enabled on sensitive tables
    SELECT
        'Row Level Security',
        CASE
            WHEN (SELECT COUNT(*) FROM pg_tables WHERE rowsecurity = true AND tablename IN ('users', 'wallets', 'transactions')) = 3
            THEN 'PASS'
            ELSE 'FAIL'
        END,
        'RLS enabled on ' || (SELECT COUNT(*) FROM pg_tables WHERE rowsecurity = true AND tablename IN ('users', 'wallets', 'transactions')) || '/3 sensitive tables'

    UNION ALL

    -- Check audit logging
    SELECT
        'Audit Logging',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN 'Audit log table exists' ELSE 'Audit log table missing' END

    UNION ALL

    -- Check encryption extension
    SELECT
        'Encryption Extension',
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN 'pgcrypto extension available' ELSE 'pgcrypto extension missing' END;
END;
$$ LANGUAGE plpgsql;

-- Create security validation view
CREATE OR REPLACE VIEW security.configuration_status AS
SELECT * FROM validate_security_configuration();

-- ============================================================================
-- SECURITY HARDENING COMPLETION
-- ============================================================================

-- Reload configuration to apply changes
SELECT pg_reload_conf();

-- Report completion
DO $$
BEGIN
    RAISE NOTICE 'Database security hardening completed successfully';
    RAISE NOTICE 'Important: Change all default passwords (CHANGE_ME_*) before production deployment';
    RAISE NOTICE 'Important: Configure SSL certificates and restart PostgreSQL';
    RAISE NOTICE 'Important: Set up proper connection pooling with PgBouncer';
    RAISE NOTICE 'Monitor security: SELECT * FROM security.configuration_status';
    RAISE NOTICE 'Monitor activity: SELECT * FROM security.failed_logins';
    RAISE NOTICE 'Monitor sensitive access: SELECT * FROM security.sensitive_data_access';
END $$;