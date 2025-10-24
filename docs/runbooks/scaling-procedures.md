# Scaling Procedures Runbook

## Overview

This runbook provides procedures for scaling the Telegram Labeling Platform to handle increased load, including horizontal and vertical scaling strategies.

## Scaling Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│   API Gateway   │────│  Microservices  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌─────────────────┐           │
                       │   CDNs & Cache  │───────────┘
                       └─────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │────│      Redis      │────│  File Storage   │
│   (Primary)     │    │    (Cluster)    │    │     (S3)        │
│   (Read Replicas)│   │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Scaling Triggers

### Metrics to Monitor

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU Usage | > 70% for 5 min | Scale out |
| Memory Usage | > 80% for 5 min | Scale out |
| Response Time | P95 > 2s | Scale out |
| Queue Depth | > 1000 tasks | Scale out |
| Database Connections | > 150 | Scale out |
| Error Rate | > 5% | Scale out/investigate |

### Auto-scaling Configuration

```yaml
# docker-compose.autoscale.yml
version: '3.8'

services:
  backend:
    image: labelmint/backend:latest
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.backend.rule=Host(`api.labelmint.it`)"
        - "traefik.http.services.backend.loadbalancer.sticky.cookie=true"

  nginx:
    image: nginx:alpine
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

## Horizontal Scaling

### 1. Scaling API Services

#### Docker Compose Scaling

```bash
# Scale backend services
docker-compose up -d --scale backend=5

# Scale worker services
docker-compose up -d --scale worker=10

# Verify scaling
docker-compose ps
curl http://localhost/api/health
```

#### Kubernetes Scaling

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: labelmint/backend:latest
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### AWS ECS Auto Scaling

```bash
# Create ECS service with auto scaling
aws ecs create-service \
  --cluster labeling-platform \
  --service-name backend \
  --task-definition backend \
  --desired-count 3 \
  --minimum-healthy-percent 50 \
  --maximum-percent 200 \
  --deployment-configuration maximumPercent=200,minimumHealthyPercent=50

# Create auto scaling target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/labeling-platform/backend \
  --min-capacity 2 \
  --max-capacity 20

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/labeling-platform/backend \
  --policy-name backend-scale-out \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-config.json
```

### 2. Scaling Database

#### Read Replicas

```sql
-- On primary: Create replica user
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'strong_password';

-- On primary: Configure postgresql.conf
wal_level = replica
max_wal_senders = 3
wal_keep_segments = 64
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'

-- On replica: Configure recovery.conf
standby_mode = 'on'
primary_conninfo = 'host=primary port=5432 user=replicator'
trigger_file = '/tmp/postgresql.trigger'
```

#### Connection Pooling with PgBouncer

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
labeling_platform = host=primary-db port=5432 dbname=labeling_platform
labeling_platform_ro = host=replica-db port=5432 dbname=labeling_platform

[pgbouncer]
listen_port = 6432
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
max_db_connections = 50
max_user_connections = 50
```

#### Database Sharding Strategy

```sql
-- Create shard tables by project_id
CREATE TABLE tasks_shard_1 (LIKE tasks INCLUDING ALL);
CREATE TABLE tasks_shard_2 (LIKE tasks INCLUDING ALL);
CREATE TABLE tasks_shard_3 (LIKE tasks INCLUDING ALL);

-- Create routing function
CREATE OR REPLACE FUNCTION route_task(project_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  shard_num INTEGER;
BEGIN
  shard_num := project_id % 3 + 1;
  RETURN 'tasks_shard_' || shard_num;
END;
$$ LANGUAGE plpgsql;
```

### 3. Scaling Caching

#### Redis Cluster Setup

```bash
# Create Redis cluster
docker-compose up -d redis-node-1 redis-node-2 redis-node-3

# Initialize cluster
docker-compose exec redis-node-1 redis-cli --cluster create \
  172.20.0.10:7000 172.20.0.11:7000 172.20.0.12:7000 \
  --cluster-replicas 0

# Verify cluster
docker-compose exec redis-node-1 redis-cli --cluster info 172.20.0.10:7000
```

#### Multi-level Caching Strategy

```javascript
// Cache levels implementation
class CacheManager {
  constructor() {
    this.l1Cache = new Map(); // In-memory
    this.l2Cache = redis.createClient(); // Redis
    this.l3Cache = memcached.createClient(); // Memcached
  }

  async get(key) {
    // L1: In-memory (fastest)
    if (this.l1Cache.has(key)) {
      return this.l1Cache.get(key);
    }

    // L2: Redis
    let value = await this.l2Cache.get(key);
    if (value) {
      this.l1Cache.set(key, value);
      return value;
    }

    // L3: Memcached (shared across instances)
    value = await this.l3Cache.get(key);
    if (value) {
      await this.l2Cache.set(key, value, 300);
      this.l1Cache.set(key, value);
      return value;
    }

    return null;
  }
}
```

## Vertical Scaling

### 1. Increasing Instance Resources

```bash
# AWS EC2 instance resize
aws ec2 modify-instance-attribute \
  --instance-id i-1234567890abcdef0 \
  --instance-type t3.large

# Verify instance type
aws ec2 describe-instances \
  --instance-ids i-1234567890abcdef0 \
  --query "Reservations[].Instances[].InstanceType"
```

### 2. Memory Optimization

```javascript
// Node.js memory management
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Cluster mode for multi-core
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  require('./app.js');
}
```

### 3. Database Performance Tuning

```sql
-- PostgreSQL configuration tuning
-- postgresql.conf
shared_buffers = 4GB                  -- 25% of RAM
effective_cache_size = 12GB           -- 75% of RAM
work_mem = 64MB                       -- Per operation
maintenance_work_mem = 1GB            -- For VACUUM/CREATE INDEX
checkpoint_completion_target = 0.9    -- Smooth checkpoints
wal_buffers = 64MB                    -- WAL buffer size
default_statistics_target = 100       -- Better query planning
random_page_cost = 1.1                -- For SSD storage
effective_io_concurrency = 200        -- For SSD
```

## Load Testing Before Scaling

### Performance Testing Script

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200
    { duration: '5m', target: 200 },   // Stay at 200
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% under 500ms
    http_req_failed: ['rate<0.01'],    // <1% errors
  },
};

export default function() {
  // Test task creation
  let response = http.post('https://api.labelmint.it/api/v1/tasks', JSON.stringify({
    project_id: 1,
    data: {
      type: 'text',
      text: 'Test message for load testing'
    }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'test-key',
    },
  });

  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### Running Load Tests

```bash
# Install k6
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz

# Run load test
./k6 run load-test.js

# Run with distributed load
./k6 cloud load-test.js

# Test different scenarios
./k6 run --vus 500 --duration 10m load-test.js
```

## Scaling Event Procedures

### Planned Scaling (Event Preparation)

```bash
#!/bin/bash
# pre-scale-for-event.sh

EVENT_NAME="product_launch"
SCALE_FACTOR=5
BACKUP_BEFORE=true

echo "Preparing for scaling event: $EVENT_NAME"

# 1. Create backup
if [ "$BACKUP_BEFORE" = true ]; then
    echo "Creating pre-event backup..."
    ./scripts/backup-all.sh
    aws s3 cp /backups s3://labelmint-backups/pre-events/$(date +%Y%m%d_%H%M%S)/ --recursive
fi

# 2. Scale services
echo "Scaling services by factor of $SCALE_FACTOR..."

# Scale backend
docker-compose up -d --scale backend=$(($SCALE_FACTOR * 2))

# Scale workers
docker-compose up -d --scale worker=$(($SCALE_FACTOR * 5))

# Scale read replicas
aws rds create-db-instance-read-replica \
    --db-instance-identifier labeling-platform-replica-event \
    --source-db-instance-identifier labeling-platform \
    --db-instance-class db.m5.large

# 3. Warm up caches
echo "Warming up caches..."
curl -X POST https://api.labelmint.it/admin/cache/warm-up

# 4. Update monitoring thresholds
echo "Updating monitoring thresholds..."
# Update Prometheus rules
kubectl apply -f monitoring/event-alerts.yaml

# 5. Notify team
echo "Notifying team..."
slack-notify "📈 Scaling for $EVENT_NAME complete. Ready for increased load."

echo "Event preparation complete!"
```

### Emergency Scaling (Unexpected Load)

```bash
#!/bin/bash
# emergency-scale.sh

ALERT_TYPE=$1
SCALE_FACTOR=${2:-3}

echo "Emergency scaling triggered: $ALERT_TYPE"

# 1. Immediate scaling
echo "Immediate scaling actions..."

# Double backend instances
docker-compose up -d --scale backend=6

# Triple worker instances
docker-compose up -d --scale worker=15

# Add temporary read replica
aws rds create-db-instance-read-replica \
    --db-instance-identifier labeling-platform-replica-emergency \
    --source-db-instance-identifier labeling-platform \
    --db-instance-class db.m5.xlarge \
    --no-multi-az

# 2. Enable request queuing
echo "Enabling request queueing..."
curl -X POST https://api.labelmint.it/admin/config/update \
    -d '{"queue_enabled": true, "queue_max_size": 10000}'

# 3. Enable aggressive caching
echo "Enabling aggressive caching..."
curl -X POST https://api.labelmint.it/admin/cache/config \
    -d '{"ttl": 3600, "aggressive": true}'

# 4. Rate limit adjustments
echo "Adjusting rate limits..."
curl -X POST https://api.labelmint.it/admin/rate-limit/update \
    -d '{"requests_per_minute": 500, "burst": 1000}'

# 5. Notify team
echo "Notifying on-call team..."
pagerduty-incident "Emergency scaling activated due to $ALERT_TYPE"
slack-notify "🚨 Emergency scaling activated for $ALERT_TYPE. Immediate action required."

echo "Emergency scaling complete. Monitoring system..."
```

### Post-Event Scaling Down

```bash
#!/bin/bash
# post-event-scale-down.sh

echo "Scaling down after event..."

# 1. Gradual scale down
echo "Gradual scale down over 30 minutes..."

# Phase 1: Reduce by 50%
docker-compose up -d --scale backend=3
docker-compose up -d --scale worker=8
sleep 600

# Phase 2: Reduce to normal
docker-compose up -d --scale backend=2
docker-compose up -d --scale worker=3
sleep 600

# 2. Remove temporary replicas
echo "Removing temporary read replicas..."
aws rds delete-db-instance \
    --db-instance-identifier labeling-platform-replica-event \
    --skip-final-snapshot

aws rds delete-db-instance \
    --db-instance-identifier labeling-platform-replica-emergency \
    --skip-final-snapshot

# 3. Reset configurations
echo "Resetting configurations to normal..."
curl -X POST https://api.labelmint.it/admin/config/reset
curl -X POST https://api.labelmint.it/admin/cache/reset
curl -X POST https://api.labelmint.it/admin/rate-limit/reset

# 4. Create post-event backup
echo "Creating post-event backup..."
./scripts/backup-all.sh

# 5. Generate scaling report
echo "Generating scaling report..."
./scripts/generate-scaling-report.sh

echo "Scale down complete!"
```

## Monitoring Scaled Infrastructure

### Key Metrics to Track

```yaml
# Grafana dashboard for scaling
dashboard:
  title: "Platform Scaling Metrics"
  panels:
    - title: "Active Instances"
      metrics:
        - backend_instances
        - worker_instances
        - database_replicas

    - title: "Resource Utilization"
      metrics:
        - cpu_usage_per_instance
        - memory_usage_per_instance
        - network_io

    - title: "Performance Metrics"
      metrics:
        - requests_per_second
        - average_response_time
        - error_rate
        - queue_depth

    - title: "Cost Metrics"
      metrics:
        - hourly_cost
        - cost_per_request
        - total_monthly_cost
```

### Cost Optimization

```bash
#!/bin/bash
# optimize-scaling-costs.sh

echo "Analyzing scaling costs..."

# 1. Identify over-provisioned resources
echo "Checking for over-provisioned resources..."
aws ec2 describe-instances --filters "Name=tag:Environment,Values=production" \
  --query "Reservations[*].Instances[*].[InstanceId,InstanceType,Monitoring.State]" \
  | jq '.[] | select(.[1] | contains("large")) | .[0]'

# 2. Recommend right-sizing
echo "Generating right-sizing recommendations..."
./scripts/analyze-instance-usage.sh

# 3. Schedule scaling for cost optimization
echo "Scheduling cost-optimized scaling..."
# Scale down during off-peak hours
echo "0 2 * * * /opt/scripts/scale-down-offpeak.sh" | crontab -
echo "0 8 * * * /opt/scripts/scale-up-peak.sh" | crontab -

echo "Cost optimization complete!"
```

## Related Runbooks

- [Incident Response](./incident-response.md)
- [Performance Troubleshooting](./performance-troubleshooting.md)
- [Database Maintenance](./database-maintenance.md)

## Contacts

- **Infrastructure Team**: infra@labelmint.it
- **DevOps Team**: devops@labelmint.it
- **On-call Engineer**: oncall@labelmint.it
- **Cloud Support**: AWS Premium Support