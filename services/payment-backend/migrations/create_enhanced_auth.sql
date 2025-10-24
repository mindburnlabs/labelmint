-- Enhanced Authentication System Migration

-- Add 2FA support to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT; -- JSON array of backup codes
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20); -- For SMS 2FA
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Create user sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB, -- Device fingerprint
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create refresh token table for rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    device_id VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    replaced_by_token_id INTEGER REFERENCES refresh_tokens(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create login attempts table for brute force protection
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100), -- 'invalid_password', 'account_locked', '2fa_required', etc.
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create account lockouts table
CREATE TABLE IF NOT EXISTS account_lockouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lock_type VARCHAR(50) NOT NULL, -- 'brute_force', 'suspicious_activity', 'admin_action'
    reason TEXT,
    locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) -- Admin who locked the account
);

-- Create password history table
CREATE TABLE IF NOT EXISTS password_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create 2FA backup codes table
CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create security audit log table
CREATE TABLE IF NOT EXISTS security_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'login', 'logout', '2fa_enabled', 'password_change', etc.
    resource VARCHAR(100), -- Resource being accessed
    result VARCHAR(20) NOT NULL, -- 'success', 'failure', 'blocked'
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    details JSONB, -- Additional context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create device tracking table
CREATE TABLE IF NOT EXISTS trusted_devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name VARCHAR(100),
    trusted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, device_fingerprint)
);

-- Create email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints and indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_user_id ON account_lockouts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_active ON account_lockouts(is_active);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_until ON account_lockouts(locked_until);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);

CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON security_audit_log(ip_address);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);

-- Create function to check password reuse
CREATE OR REPLACE FUNCTION check_password_reuse(
    p_user_id INTEGER,
    p_password_hash VARCHAR(255),
    p_history_count INTEGER DEFAULT 5
) RETURNS BOOLEAN AS $$
DECLARE
    reuse_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO reuse_count
    FROM password_history
    WHERE user_id = p_user_id
    AND password_hash = p_password_hash
    ORDER BY created_at DESC
    LIMIT p_history_count;

    RETURN reuse_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_user_id INTEGER,
    p_action VARCHAR(100),
    p_resource VARCHAR(100) DEFAULT NULL,
    p_result VARCHAR(20),
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id VARCHAR(255) DEFAULT NULL,
    p_details JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO security_audit_log (
        user_id, action, resource, result, ip_address,
        user_agent, session_id, details
    ) VALUES (
        p_user_id, p_action, p_resource, p_result, p_ip_address,
        p_user_agent, p_session_id, p_details
    );
END;
$$ LANGUAGE plpgsql;

-- Create procedure to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS VOID AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();

    DELETE FROM refresh_tokens
    WHERE expires_at < NOW()
    OR (is_revoked = true AND revoked_at < NOW() - INTERVAL '7 days');

    DELETE FROM email_verification_tokens
    WHERE expires_at < NOW() OR is_used = true;

    DELETE FROM password_reset_tokens
    WHERE expires_at < NOW() OR is_used = true;

    DELETE FROM two_factor_backup_codes
    WHERE expires_at < NOW() OR is_used = true;

    -- Deactivate expired trusted devices
    UPDATE trusted_devices
    SET is_active = false
    WHERE expires_at IS NOT NULL AND expires_at < NOW();

    -- Deactivate expired lockouts
    UPDATE account_lockouts
    SET is_active = false
    WHERE locked_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically log password changes
CREATE OR REPLACE FUNCTION trigger_password_change_log()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.password_hash != NEW.password_hash THEN
        -- Add to password history
        INSERT INTO password_history (user_id, password_hash)
        VALUES (NEW.id, NEW.password_hash);

        -- Log security event
        PERFORM log_security_event(
            NEW.id,
            'password_change',
            'user_account',
            'success',
            NULL,
            NULL,
            NULL,
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
DROP TRIGGER IF EXISTS trigger_password_change ON users;
CREATE TRIGGER trigger_password_change
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_password_change_log();

-- Schedule cleanup job (requires pg_cron extension)
-- Uncomment if pg_cron is installed
-- SELECT cron.schedule('cleanup-sessions', '0 */2 * * *', 'SELECT cleanup_expired_sessions();');

-- Insert default security settings
INSERT INTO system_settings (key, value, description)
VALUES
    ('max_login_attempts', '5', 'Maximum failed login attempts before lockout'),
    ('lockout_duration_minutes', '15', 'Duration of account lockout in minutes'),
    ('session_timeout_hours', '24', 'Default session timeout in hours'),
    ('password_min_length', '12', 'Minimum password length'),
    ('password_require_uppercase', 'true', 'Require uppercase letters in password'),
    ('password_require_lowercase', 'true', 'Require lowercase letters in password'),
    ('password_require_numbers', 'true', 'Require numbers in password'),
    ('password_require_symbols', 'true', 'Require special characters in password'),
    ('password_history_count', '5', 'Number of previous passwords to check for reuse'),
    ('2fa_required_for_admin', 'true', 'Require 2FA for admin users'),
    ('trusted_device_days', '30', 'Number of days to trust a device without 2FA')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();