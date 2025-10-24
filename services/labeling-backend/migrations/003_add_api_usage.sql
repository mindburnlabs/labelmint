-- API usage tracking table
CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER, -- in milliseconds
    request_size INTEGER, -- in bytes
    response_size INTEGER, -- in bytes
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_trunc_day DATE GENERATED ALWAYS AS (date_trunc('day', created_at)) STORED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_id ON api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_date_trunc_day ON api_usage(date_trunc_day);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);

-- Create a partitioned table for better performance with large datasets
CREATE TABLE IF NOT EXISTS api_usage_partitioned (
    LIKE api_usage INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (automatically managed)
-- Note: This requires PostgreSQL 10+
-- For PostgreSQL 14+, you can use GENERATED ALWAYS AS IDENTITY
-- and automatically create partitions as needed