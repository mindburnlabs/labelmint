#!/bin/bash

# Database replication setup script
# Usage: ./setup-replication.sh [primary|replica]

set -euo pipefail

ROLE=${1:-primary}
POSTGRES_VERSION=${POSTGRES_VERSION:-16}
REPLICA_USER=${REPLICA_USER:-replicator}
REPLICA_PASSWORD=${REPLICA_PASSWORD:-$(openssl rand -base64 32)}
PRIMARY_HOST=${PRIMARY_HOST:-localhost}
REPLICA_HOST=${REPLICA_HOST:-localhost}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Create replication user on primary
setup_primary() {
    log "Setting up primary server for replication"

    # Create replication user
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        CREATE USER $REPLICA_USER REPLICATION LOGIN CONNECTION LIMIT 3 ENCRYPTED PASSWORD '$REPLICA_PASSWORD';
        GRANT CONNECT ON DATABASE $POSTGRES_DB TO $REPLICA_USER;
        GRANT USAGE ON SCHEMA pg_catalog TO $REPLICA_USER;
        GRANT SELECT ON pg_authid TO $REPLICA_USER;

        -- Create publication for all tables
        CREATE PUBLICATION labelmint_pub FOR ALL TABLES;

        -- Create replication slot for each replica
        SELECT * FROM pg_create_physical_replication_slot('labelmint_slot_1');
EOSQL

    # Configure postgresql.conf for replication
    cat >> /etc/postgresql/$POSTGRES_VERSION/main/postgresql.conf <<EOF

# Replication settings
wal_level = replica
max_wal_senders = 5
max_replication_slots = 5
wal_keep_size = 1GB
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
synchronous_commit = on
synchronous_standby_names = 'replica1'
EOF

    # Configure pg_hba.conf for replication
    echo "host replication $REPLICA_USER 0.0.0.0/0 md5" >> /etc/postgresql/$POSTGRES_VERSION/main/pg_hba.conf

    # Save credentials
    echo "REPLICA_USER=$REPLICA_USER" > /etc/postgresql/replication.env
    echo "REPLICA_PASSWORD=$REPLICA_PASSWORD" >> /etc/postgresql/replication.env

    log "Primary server configured successfully"
    log "Replication credentials saved to /etc/postgresql/replication.env"
}

# Setup replica server
setup_replica() {
    log "Setting up replica server"

    if [[ ! -f /etc/postgresql/replication.env ]]; then
        error "Replication credentials not found. Please run primary setup first."
    fi

    source /etc/postgresql/replication.env

    # Stop PostgreSQL service
    systemctl stop postgresql

    # Remove existing data directory
    rm -rf /var/lib/postgresql/$POSTGRES_VERSION/main/*

    # Create base backup from primary
    PGPASSWORD=$REPLICA_PASSWORD pg_basebackup \
        -h $PRIMARY_HOST \
        -D /var/lib/postgresql/$POSTGRES_VERSION/main \
        -U $REPLICA_USER \
        -v -P -W -Fp -Xs -R

    # Configure standby mode
    cat > /var/lib/postgresql/$POSTGRES_VERSION/main/recovery.conf <<EOF
standby_mode = 'on'
primary_conninfo = 'host=$PRIMARY_HOST port=5432 user=$REPLICA_USER password=$REPLICA_PASSWORD sslmode=require'
primary_slot_name = 'labelmint_slot_1'
recovery_target_timeline = 'latest'
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
EOF

    # Configure postgresql.conf for replica
    cat >> /etc/postgresql/$POSTGRES_VERSION/main/postgresql.conf <<EOF

# Replica settings
hot_standby = on
max_standby_streaming_delay = 30s
max_standby_archive_delay = 30s
wal_receiver_status_interval = 10s
hot_standby_feedback = on
EOF

    # Set correct permissions
    chown -R postgres:postgres /var/lib/postgresql/$POSTGRES_VERSION/main

    # Start PostgreSQL service
    systemctl start postgresql

    log "Replica server configured and started"
}

# Verify replication status
verify_replication() {
    log "Verifying replication status"

    # Check on primary
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT
            pid,
            state,
            sent_lsn,
            write_lsn,
            flush_lsn,
            replay_lsn,
            sync_state,
            application_name
        FROM pg_stat_replication;

        SELECT
            slot_name,
            plugin,
            slot_type,
            active,
            restart_lsn,
            wal_status
        FROM pg_replication_slots;
EOSQL

    # Check on replica
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT
            pg_is_in_recovery(),
            pg_last_wal_receive_lsn(),
            pg_last_wal_replay_lsn(),
            pg_last_xact_replay_timestamp();
EOSQL
}

# Setup failover monitoring
setup_failover_monitoring() {
    log "Setting up failover monitoring"

    cat > /usr/local/bin/check-replication.sh <<'EOF'
#!/bin/bash

REPLICA_LAG=$(psql -t -A -U postgres -d postgres -c "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::integer;")
MAX_LAG=${MAX_LAG:-60}

if [[ $REPLICA_LAG -gt $MAX_LAG ]]; then
    echo "CRITICAL: Replica lag is $REPLICA_LAG seconds (threshold: $MAX_LAG)"
    # Trigger failover logic here
    exit 2
else
    echo "OK: Replica lag is $REPLICA_LAG seconds"
    exit 0
fi
EOF

    chmod +x /usr/local/bin/check-replication.sh

    # Add to crontab
    (crontab -l 2>/dev/null; echo "*/1 * * * * /usr/local/bin/check-replication.sh") | crontab -

    log "Failover monitoring configured"
}

# Main execution
case $ROLE in
    primary)
        setup_primary
        setup_failover_monitoring
        verify_replication
        ;;
    replica)
        setup_replica
        sleep 5
        verify_replication
        ;;
    verify)
        verify_replication
        ;;
    *)
        error "Invalid role. Use: $0 [primary|replica|verify]"
        ;;
esac

log "Replication setup completed successfully"