#!/bin/bash
# Production Entrypoint Script for LabelMint Backend Services
# ==============================================================
# Handles initialization, health checks, and graceful shutdown

set -euo pipefail

# Function to log messages with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}

# Function to check if service is ready
wait_for_service() {
    local host="$1"
    local port="$2"
    local service="$3"
    local timeout="${4:-60}"

    log "Waiting for $service at $host:$port..."

    for i in $(seq 1 $timeout); do
        if nc -z "$host" "$port" 2>/dev/null; then
            log "$service is ready!"
            return 0
        fi
        log "Attempt $i/$timeout: $service not ready, waiting..."
        sleep 1
    done

    log "ERROR: $service not ready after $timeout seconds"
    return 1
}

# Function to check database connectivity
check_database() {
    log "Checking database connectivity..."

    if command -v psql >/dev/null 2>&1; then
        psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1 || {
            log "ERROR: Database connection failed"
            return 1
        }
        log "Database connection successful"
    else
        log "WARNING: psql not available, skipping database health check"
    fi
}

# Function to check Redis connectivity
check_redis() {
    if [[ -n "${REDIS_URL:-}" ]]; then
        log "Checking Redis connectivity..."

        if command -v redis-cli >/dev/null 2>&1; then
            redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1 || {
                log "ERROR: Redis connection failed"
                return 1
            }
            log "Redis connection successful"
        else
            log "WARNING: redis-cli not available, skipping Redis health check"
        fi
    fi
}

# Function to run database migrations
run_migrations() {
    if [[ "${SKIP_MIGRATIONS:-false}" != "true" ]]; then
        log "Running database migrations..."
        cd /app
        npm run db:migrate || {
            log "ERROR: Database migrations failed"
            return 1
        }
        log "Database migrations completed successfully"
    else
        log "Skipping database migrations (SKIP_MIGRATIONS=true)"
    fi
}

# Function to create necessary directories
create_directories() {
    log "Creating necessary directories..."

    mkdir -p /app/logs /app/uploads /app/cache

    # Set proper permissions
    chmod 755 /app/logs /app/uploads /app/cache

    # Create log files if they don't exist
    touch /app/logs/app.log /app/logs/error.log
    chmod 644 /app/logs/*.log

    log "Directories created successfully"
}

# Function to handle graceful shutdown
graceful_shutdown() {
    log "Received shutdown signal, initiating graceful shutdown..."

    # Send SIGTERM to the Node.js process
    if [[ -n "${NODE_PID:-}" ]]; then
        log "Sending SIGTERM to Node.js process (PID: $NODE_PID)"
        kill -TERM "$NODE_PID"

        # Wait for process to exit gracefully
        wait "$NODE_PID" || {
            log "Process did not exit gracefully, forcing shutdown"
            kill -KILL "$NODE_PID" 2>/dev/null || true
        }
    fi

    log "Graceful shutdown completed"
    exit 0
}

# Function to start application
start_application() {
    log "Starting LabelMint Backend Application..."
    log "Environment: $NODE_ENV"
    log "Port: $PORT"
    log "Log Level: $LOG_LEVEL"

    # Set trap for graceful shutdown
    trap graceful_shutdown SIGTERM SIGINT

    # Start the application in background
    exec "$@" &
    NODE_PID=$!

    log "Application started with PID: $NODE_PID"

    # Wait for the application to exit
    wait "$NODE_PID"

    log "Application exited with code: $?"
}

# Main execution
main() {
    log "LabelMint Backend Entrypoint - Starting initialization..."

    # Create necessary directories
    create_directories

    # Parse DATABASE_URL to extract host and port
    if [[ -n "${DATABASE_URL:-}" ]]; then
        # Extract host and port from DATABASE_URL
        # Example: postgresql://user:pass@localhost:5432/db
        if [[ "$DATABASE_URL" =~ @([^:]+):([0-9]+) ]]; then
            DB_HOST="${BASH_REMATCH[1]}"
            DB_PORT="${BASH_REMATCH[2]}"

            # Wait for database
            wait_for_service "$DB_HOST" "$DB_PORT" "PostgreSQL" 60

            # Check database connectivity
            check_database
        fi
    fi

    # Parse REDIS_URL to extract host and port
    if [[ -n "${REDIS_URL:-}" ]]; then
        # Extract host and port from REDIS_URL
        # Example: redis://localhost:6379
        if [[ "$REDIS_URL" =~ redis://([^:]+):([0-9]+) ]]; then
            REDIS_HOST="${BASH_REMATCH[1]}"
            REDIS_PORT="${BASH_REMATCH[2]}"

            # Wait for Redis
            wait_for_service "$REDIS_HOST" "$REDIS_PORT" "Redis" 30

            # Check Redis connectivity
            check_redis
        fi
    fi

    # Run database migrations
    run_migrations

    # Log startup information
    log "=== LabelMint Backend Startup Information ==="
    log "Version: ${APP_VERSION:-unknown}"
    log "Build Date: ${BUILD_DATE:-unknown}"
    log "Commit: ${COMMIT_SHA:-unknown}"
    log "Environment: $NODE_ENV"
    log "Port: $PORT"
    log "Worker Concurrency: ${WORKER_CONCURRENCY:-10}"
    log "Enable Metrics: ${ENABLE_METRICS:-true}"
    log "=========================================="

    # Start the application
    start_application "$@"
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi