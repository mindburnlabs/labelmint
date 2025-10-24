# Database Maintenance Runbook

## Overview

This runbook covers routine database maintenance tasks, performance optimization, and emergency procedures for the Telegram Labeling Platform PostgreSQL database.

## Database Information

- **Database**: PostgreSQL 16
- **Host**: postgres.internal.labelmint.it
- **Port**: 5432
- **Primary DB**: labeling_platform
- **Replica DB**: labeling_platform_replica
- **Backup Retention**: 30 days
- **Connection Pool**: PgBouncer

## Quick Reference

```bash
# Connect to database
docker-compose exec postgres psql -U labeling_user -d labeling_platform

# Check database size
SELECT pg_size_pretty(pg_database_size('labeling_platform'));

# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check slow queries
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

## Routine Maintenance

### Daily Tasks

1. **Check Database Health** (Automated at 08:00 UTC)
   ```bash
   #!/bin/bash
   # db-health-check.sh

   echo "=== Database Health Check ==="
   echo "Time: $(date)"

   # Check connection
   if docker-compose exec -T postgres pg_isready; then
       echo "✓ Database is ready"
   else
       echo "✗ Database is not ready"
       exit 1
   fi

   # Check size
   SIZE=$(docker-compose exec -T postgres psql -U labeling_user -t -c "SELECT pg_size_pretty(pg_database_size('labeling_platform'));")
   echo "Database size: $SIZE"

   # Check connections
   CONNS=$(docker-compose exec -T postgres psql -U labeling_user -t -c "SELECT count(*) FROM pg_stat_activity;")
   echo "Active connections: $CONNS"

   # Check long queries
   LONG=$(docker-compose exec -T postgres psql -U labeling_user -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '5 minutes';")
   if [ $LONG -gt 0 ]; then
       echo "⚠️ $LONG long-running queries detected"
   fi

   echo "=== Health Check Complete ==="
   ```

2. **Vacuum Analyze** (Automated at 02:00 UTC)
   ```sql
   -- Vacuum analyze tables with high bloat
   SELECT schemaname, tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_stat_get_dead_tuples(c.oid) as dead_tuples
   FROM pg_class c
   LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE relkind = 'r'
     AND n.nspname = 'public'
     AND pg_stat_get_dead_tuples(c.oid) > 1000
   ORDER BY dead_tuples DESC;

   -- Run vacuum on high-bloat tables
   VACUUM ANALYZE tasks;
   VACUUM ANALYZE task_results;
   VACUUM ANALYZE users;
   ```

### Weekly Tasks

1. **Index Maintenance** (Sundays at 03:00 UTC)
   ```sql
   -- Check index usage
   SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE idx_scan < 100
     AND schemaname NOT IN ('pg_catalog', 'information_schema');

   -- Rebuild unused indexes
   REINDEX INDEX CONCURRENTLY idx_tasks_created_at;

   -- Update statistics
   ANALYZE;
   ```

2. **Performance Review** (Mondays at 09:00 UTC)
   ```sql
   -- Top slow queries
   SELECT query, mean_time, calls, total_time
   FROM pg_stat_statements
   WHERE mean_time > 100
   ORDER BY mean_time DESC
   LIMIT 20;

   -- Table sizes
   SELECT schemaname, tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

### Monthly Tasks

1. **Full Vacuum** (First Sunday of month)
   ```bash
   # Schedule during low traffic (e.g., 02:00 UTC Sunday)
   docker-compose exec postgres psql -U labeling_user -c "
     VACUUM FULL tasks;
     VACUUM FULL task_results;
     VACUUM FULL users;
     VACUUM FULL projects;
   "
   ```

2. **Update Statistics** (First Monday of month)
   ```sql
   -- Update table statistics with higher default
   ALTER DATABASE labeling_platform SET default_statistics_target = 100;

   -- Analyze all tables
   ANALYZE;

   -- Check for missing statistics
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE schemaname = 'public'
     AND n_distinct = -1
   ORDER BY tablename, attname;
   ```

## Performance Optimization

### Query Optimization

1. **Identify Slow Queries**
   ```sql
   -- Enable query logging temporarily
   ALTER SYSTEM SET log_min_duration_statement = 1000;
   SELECT pg_reload_conf();

   -- After 1 hour, check logs
   grep "duration:" /var/log/postgresql/postgresql-16-main.log | sort -k5 -n
   ```

2. **Optimize Specific Queries**
   ```sql
   -- Example: Optimize task listing
   EXPLAIN ANALYZE
   SELECT t.*, u.username
   FROM tasks t
   JOIN users u ON t.worker_id = u.id
   WHERE t.status = 'completed'
     AND t.created_at > NOW() - INTERVAL '1 day'
   ORDER BY t.created_at DESC
   LIMIT 100;

   -- Add index if needed
   CREATE INDEX CONCURRENTLY idx_tasks_status_created_at
   ON tasks(status, created_at DESC);
   ```

3. **Partition Large Tables**
   ```sql
   -- Partition task_results by date
   CREATE TABLE task_results_partitioned (
       LIKE task_results INCLUDING ALL
   ) PARTITION BY RANGE (created_at);

   -- Create monthly partitions
   CREATE TABLE task_results_2024_01 PARTITION OF task_results_partitioned
       FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
   ```

### Connection Pooling

1. **Configure PgBouncer**
   ```ini
   # /etc/pgbouncer/pgbouncer.ini
   [databases]
   labeling_platform = host=localhost port=5432 dbname=labeling_platform

   [pgbouncer]
   listen_port = 6432
   listen_addr = 127.0.0.1
   auth_type = md5
   auth_file = /etc/pgbouncer/userlist.txt
   logfile = /var/log/pgbouncer/pgbouncer.log
   pidfile = /var/run/pgbouncer/pgbouncer.pid

   # Pool settings
   pool_mode = transaction
   max_client_conn = 1000
   default_pool_size = 20
   min_pool_size = 5
   reserve_pool_size = 5
   reserve_pool_timeout = 5
   max_db_connections = 50
   max_user_connections = 50

   # timeouts
   server_reset_query = DISCARD ALL
   server_check_delay = 30
   server_check_query = select 1
   server_lifetime = 3600
   server_idle_timeout = 600
   ```

2. **Monitor Pool Usage**
   ```bash
   # Check pool status
   psql -h localhost -p 6432 -U pgbouncer -d pgbouncer -c "SHOW POOLS;"

   # Check stats
   psql -h localhost -p 6432 -U pgbouncer -d pgbouncer -c "SHOW STATS;"
   ```

## Emergency Procedures

### Emergency Recovery

1. **Database Corruption**
   ```bash
   # Stop all services
   docker-compose stop backend bot

   # Check corruption
   docker-compose exec postgres pg_dump -U labeling_user labeling_platform > /tmp/test_dump.sql

   # If corrupted, restore from backup
   # See Backup Restoration runbook
   ```

2. **Connection Exhaustion**
   ```bash
   # Check connections
   docker-compose exec postgres psql -U labeling_user -c "
     SELECT pid, usename, application_name, state, query_start
     FROM pg_stat_activity
     ORDER BY query_start;
   "

   # Kill idle connections
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle'
     AND query_start < NOW() - INTERVAL '1 hour';

   # Increase max connections temporarily
   ALTER SYSTEM SET max_connections = 400;
   SELECT pg_reload_conf();
   ```

3. **Disk Space Full**
   ```bash
   # Check space usage
   docker-compose exec postgres psql -U labeling_user -c "
     SELECT pg_database.datname,
            pg_size_pretty(pg_database_size(pg_database.datname)) AS size
     FROM pg_database;
   "

   # Clear old logs
   docker-compose exec postgres sh -c "find /var/log/postgresql -name '*.log' -mtime +7 -delete"

   # Vacuum full if necessary
   docker-compose exec postgres psql -U labeling_user -c "VACUUM FULL;"
   ```

### Failover to Replica

1. **Promote Replica to Primary**
   ```bash
   # Stop application connections
   docker-compose stop backend bot

   # On replica server:
   docker-compose exec postgres pg_ctl promote -D /var/lib/postgresql/data

   # Update connection strings
   # Update DNS/load balancer to point to new primary

   # Start applications
   docker-compose start backend bot
   ```

2. **Rebuild Old Primary as Replica**
   ```bash
   # On old primary:
   docker-compose stop postgres
   rm -rf /var/lib/postgresql/data/*

   # Create base backup from new primary
   pg_basebackup -h new-primary -U replication_user -D /var/lib/postgresql/data -P -W -R

   # Start PostgreSQL
   docker-compose start postgres
   ```

## Backup Procedures

### Automated Backups

1. **Daily Full Backup** (01:00 UTC)
   ```bash
   #!/bin/bash
   # backup-database.sh

   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR="/backups"
   DATABASE="labeling_platform"

   # Create backup
   docker-compose exec -T postgres pg_dump \
     -U labeling_user \
     -d $DATABASE \
     --format=custom \
     --compress=9 \
     --verbose \
     --file=/backups/db_backup_${TIMESTAMP}.dump

   # Verify backup
   docker-compose exec -T postgres pg_restore \
     --list /backups/db_backup_${TIMESTAMP}.dump > /tmp/backup_list_${TIMESTAMP}.txt

   # Upload to S3
   aws s3 cp /backups/db_backup_${TIMESTAMP}.dump \
     s3://labelmint-backups/database/${TIMESTAMP}/

   # Clean local backups (keep 7 days)
   find /backups -name "db_backup_*.dump" -mtime +7 -delete

   echo "Backup completed: db_backup_${TIMESTAMP}.dump"
   ```

2. **Continuous WAL Archiving**
   ```bash
   # postgresql.conf settings
   wal_level = replica
   archive_mode = on
   archive_command = 'aws s3 cp %p s3://labelmint-backups/wal/%f'
   archive_timeout = 600
   max_wal_senders = 3
   wal_keep_segments = 32
   ```

### Point-in-Time Recovery

1. **Restore to Specific Time**
   ```bash
   # Stop services
   docker-compose stop backend bot

   # Restore base backup
   docker-compose exec postgres pg_restore \
     -U labeling_user \
     -d labeling_platform \
     --clean --if-exists \
     /backups/db_backup_20240115_010000.dump

   # Configure recovery
   cat > /var/lib/postgresql/data/recovery.conf << EOF
   restore_command = 'aws s3 cp s3://labelmint-backups/wal/%f %p'
   recovery_target_time = '2024-01-15 14:30:00 UTC'
   EOF

   # Start PostgreSQL
   docker-compose start postgres

   # Verify recovery
   docker-compose exec postgres psql -U labeling_user -c "SELECT NOW();"

   # Start services
   docker-compose start backend bot
   ```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Performance Metrics**
   - Query duration (P95, P99)
   - TPS (transactions per second)
   - Cache hit ratio
   - Index usage

2. **Resource Metrics**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network I/O

3. **Database Health**
   - Connection count
   - Replication lag
   - WAL size
   - Autovacuum activity

### Alert Rules

```yaml
# Prometheus alerts for PostgreSQL
groups:
  - name: postgres
    rules:
      - alert: PostgreSQLDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: PostgreSQL is down

      - alert: PostgreSQLTooManyConnections
        expr: pg_stat_activity_count > 180
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Too many PostgreSQL connections

      - alert: PostgreSQLSlowQueries
        expr: rate(pg_stat_statements_mean_time_seconds[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: PostgreSQL slow queries detected

      - alert: PostgreSQLReplicationLag
        expr: pg_replication_lag_seconds > 300
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: PostgreSQL replication lag is high
```

## Security

### Regular Security Tasks

1. **Review User Permissions** (Weekly)
   ```sql
   -- Check user roles
   SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin
   FROM pg_roles;

   -- Review object permissions
   SELECT grantee, table_name, privilege_type
   FROM information_schema.role_table_grants
   WHERE grantee != 'PUBLIC';
   ```

2. **Rotate Database Passwords** (Quarterly)
   ```bash
   # Generate new password
   NEW_PASS=$(openssl rand -base64 32)

   # Update user
   docker-compose exec postgres psql -U postgres -c "
     ALTER USER labeling_user WITH PASSWORD '$NEW_PASS';
   "

   # Update .env file
   sed -i "s/DATABASE_PASSWORD=.*/DATABASE_PASSWORD=$NEW_PASS/" .env

   # Restart services
   docker-compose restart backend bot
   ```

3. **Audit Log Review** (Monthly)
   ```sql
   -- Check for failed logins
   SELECT log_time, user_name, database_name
   FROM pg_log
   WHERE error_severity = 'ERROR'
     AND command_tag = 'authentication'
     AND log_time > NOW() - INTERVAL '1 month';

   -- Review DDL changes
   SELECT log_time, user_name, command_tag, command_text
   FROM pg_log
   WHERE command_tag IN ('CREATE', 'ALTER', 'DROP')
     AND log_time > NOW() - INTERVAL '1 month';
   ```

## Related Runbooks

- [Incident Response](./incident-response.md)
- [Backup Restoration](./backup-restoration.md)
- [Security Incidents](./security-incidents.md)
- [Performance Troubleshooting](./performance-troubleshooting.md)

## Contact Information

- **DBA Team**: dba@labelmint.it
- **Infrastructure Team**: infra@labelmint.it
- **On-call Engineer**: oncall@labelmint.it
- **PostgreSQL Support**: Enterprise support contract