# Production Database Setup & Safety

This directory contains the complete production database configuration with connection pooling, replication, backup strategy, performance optimizations, and migration safety features.

## 📁 Directory Structure

```
database/
├── config/
│   ├── pgbouncer.ini         # pgBouncer connection pooler configuration
│   ├── userlist.txt          # pgBouncer authentication
│   ├── haproxy.cfg           # Load balancer configuration
│   ├── postgresql-primary.conf  # Primary PostgreSQL config
│   ├── postgresql-replica.conf   # Replica PostgreSQL config
│   └── pg_hba.conf           # PostgreSQL host-based authentication
├── scripts/
│   ├── setup-replication.sh  # Initialize database replication
│   ├── backup-strategy.sh    # Backup and recovery automation
│   ├── performance-optimization.sql  # Performance tuning SQL
│   ├── connection-monitor.sh # Connection and performance monitoring
│   └── migrate-safe.sh       # Safe migration deployment
├── migrations/               # Database migration files
├── monitoring/
│   ├── prometheus.yml        # Prometheus configuration
│   └── grafana/
│       └── provisioning/     # Grafana dashboards
├── docker-compose.yml        # Complete database stack
└── README.md                 # This file
```

## 🚀 Quick Start

### 1. Environment Configuration

Create a `.env` file with your credentials:

```bash
# Database credentials
POSTGRES_DB=deligate_prod
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
REPLICATION_USER=replicator
REPLICATION_PASSWORD=your_replication_password

# Redis
REDIS_PASSWORD=your_redis_password

# Backup settings
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
S3_BUCKET=deligate-backups
S3_REPLICATION_BUCKET=deligate-backups-dr

# Monitoring
SLACK_WEBHOOK_URL=your_slack_webhook
ALERT_EMAIL=alerts@deligate.it

# Grafana
GRAFANA_PASSWORD=your_grafana_password

# pgAdmin
PGADMIN_EMAIL=admin@deligate.it
PGADMIN_PASSWORD=your_pgadmin_password
```

### 2. Start the Database Stack

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps
```

### 3. Access Points

- **Primary Database**: `localhost:5432`
- **Read Replica 1**: `localhost:5433`
- **Read Replica 2**: `localhost:5434`
- **pgBouncer (Connection Pool)**: `localhost:6432`
- **HAProxy (Load Balancer)**: `localhost:5400`
- **Redis**: `localhost:6379`
- **pgAdmin**: `http://localhost:5050`
- **Grafana**: `http://localhost:3001`
- **Prometheus**: `http://localhost:9090`

## 🔧 Features

### 1. Connection Pooling (pgBouncer)

- Transaction pooling mode
- 100 connections per pool
- Automatic failover
- TLS encryption
- Monitoring and statistics

### 2. Database Replication

- 1 primary + 2 read replicas
- Asynchronous streaming replication
- Automatic failover monitoring
- WAL archiving for point-in-time recovery

### 3. Backup Strategy

- Daily automated full backups
- Continuous WAL archiving
- Cross-region S3 replication
- Point-in-time recovery capability
- Backup integrity verification

### 4. Performance Optimizations

- Optimized PostgreSQL settings
- Comprehensive indexing strategy
- Query performance monitoring
- Automatic vacuum tuning
- Connection and cache monitoring

### 5. Migration Safety

- Pre-deployment backups
- Staging environment testing
- Migration dry-run validation
- Automatic rollback on failure
- Zero-downtime migrations
- Health monitoring

## 📊 Monitoring

### Key Metrics Tracked

- Connection pool usage
- Query performance
- Replication lag
- Cache hit ratios
- Database bloat
- Long-running queries

### Alerts Configuration

The system sends alerts for:
- High connection usage (>80%)
- Replication lag (>60 seconds)
- Failed backups
- Migration failures
- Slow queries (>1s)

## 🔄 Migration Process

### Safe Migration Workflow

```bash
# 1. Create migration file
cat > migrations/001_add_new_table.sql << EOF
-- Migration: Add new table
BEGIN;

CREATE TABLE new_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Rollback: DROP TABLE new_table;

COMMIT;
EOF

# 2. Run safe migration
./scripts/migrate-safe.sh

# 3. Monitor health
./scripts/connection-monitor.sh

# 4. Rollback if needed
./scripts/migrate-safe.sh rollback
```

## 🛠️ Maintenance

### Daily Tasks (Automated)

- Backup creation at 2 AM
- Incremental WAL archiving
- Performance statistics collection
- Database health checks

### Weekly Tasks

- Review slow queries
- Check index usage
- Monitor replication lag
- Verify backup integrity

### Monthly Tasks

- Update statistics
- Review and optimize indexes
- Check database bloat
- Performance tuning review

## 📈 Performance Tuning

### Memory Configuration

Optimized for 32GB RAM:
- `shared_buffers`: 8GB
- `effective_cache_size`: 24GB
- `work_mem`: 256MB
- `maintenance_work_mem`: 2GB

### Connection Limits

- Max connections: 1000
- pgBouncer pool size: 100
- Reserved connections: 20

### Index Strategy

- Primary keys and foreign keys
- Query-specific indexes
- Partial indexes for filtered queries
- Composite indexes for complex queries

## 🔒 Security

- Password authentication
- TLS/SSL encryption
- Network isolation
- Role-based access control
- Audit logging
- Regular security updates

## 📞 Support

### Troubleshooting

1. Check service status:
   ```bash
   docker-compose logs [service-name]
   ```

2. Monitor connections:
   ```bash
   ./scripts/connection-monitor.sh
   ```

3. Check replication:
   ```bash
   ./scripts/setup-replication.sh verify
   ```

4. Restore from backup:
   ```bash
   ./scripts/backup-strategy.sh pitr "2024-01-01 12:00:00"
   ```

### Emergency Procedures

1. **Database Down**: Check HAProxy failover
2. **High CPU**: Monitor long-running queries
3. **Storage Full**: Clean up old backups/WALs
4. **Replication Lag**: Check network/WAL archive

## 📝 License

This configuration is proprietary to Deligate.it. Do not redistribute.