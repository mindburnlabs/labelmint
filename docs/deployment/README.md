# Deployment Guide - Telegram Labeling Platform

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Docker Deployment](#docker-deployment)
5. [Manual Deployment](#manual-deployment)
6. [Cloud Deployment](#cloud-deployment)
7. [Configuration](#configuration)
8. [Database Setup](#database-setup)
9. [SSL/TLS Configuration](#ssltls-configuration)
10. [Monitoring Setup](#monitoring-setup)
11. [Backup Strategy](#backup-strategy)
12. [Troubleshooting](#troubleshooting)

## Quick Start

### Production Deployment (Docker)

```bash
# 1. Clone repository
git clone https://github.com/labelmint/telegram-labeling-platform.git
cd telegram-labeling-platform

# 2. Configure environment
cp .env.example .env
nano .env  # Edit with your values

# 3. Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# 4. Initialize database
docker-compose exec backend npm run migrate

# 5. Create admin user
docker-compose exec backend npm run seed:admin
```

### Verify Deployment

```bash
# Check services
docker-compose ps

# Check logs
docker-compose logs -f

# Test API
curl https://api.yourdomain.com/health
```

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8 GB
- Storage: 100 GB SSD
- Network: 100 Mbps

**Recommended:**
- CPU: 8 cores
- RAM: 16 GB
- Storage: 500 GB SSD
- Network: 1 Gbps

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (for manual deployment)
- PostgreSQL 16+ (if not using Docker)
- Redis 7+ (if not using Docker)
- Nginx (recommended for production)

### Domain and SSL

- Registered domain name
- SSL certificate (recommended Let's Encrypt)
- DNS configuration ready

## Environment Setup

### Environment Variables

Create `.env` file in project root:

```bash
# Application
NODE_ENV=production
APP_NAME=Telegram Labeling Platform
APP_VERSION=1.2.0

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/labeling_platform
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=labeling_platform
DATABASE_USER=labeling_user
DATABASE_PASSWORD=your_secure_password

# Redis
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Telegram Bot
BOT_TOKEN=your_telegram_bot_token
BOT_WEBHOOK_URL=https://api.yourdomain.com/bot/webhook

# API Configuration
API_BASE_URL=https://api.yourdomain.com/v1
API_PORT=3001
API_HOST=0.0.0.0

# Authentication
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
API_SECRET=your_api_secret_for_signing

# File Upload
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,webp

# Payment (TON/USDT)
TON_WALLET_ADDRESS=your_ton_wallet_address
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
USDT_CONTRACT_ADDRESS=TonEg....

# External Services
OCR_API_KEY=your_ocr_service_key
AI_SERVICE_URL=https://ai-service.yourdomain.com
WEBHOOK_SECRET=your_webhook_secret

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn
PROMETHEUS_PORT=9464

# Email (notifications)
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your_smtp_password
```

### Security Configuration

```bash
# Generate secure secrets
openssl rand -base64 32  # JWT Secret
openssl rand -hex 32    # API Secret
openssl rand -base64 64 # Webhook Secret

# Secure database password
head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32
```

## Docker Deployment

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: labeling-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DATABASE_NAME}
      POSTGRES_USER: ${DATABASE_USER}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - backend
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G

  redis:
    image: redis:7-alpine
    container_name: labeling-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - backend
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: labeling-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=${NODE_ENV}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - BOT_TOKEN=${BOT_TOKEN}
      - JWT_SECRET=${JWT_SECRET}
      - API_SECRET=${API_SECRET}
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - backend
      - frontend
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

  bot:
    build:
      context: ./bot
      dockerfile: Dockerfile.prod
    container_name: labeling-bot
    restart: unless-stopped
    environment:
      - BOT_TOKEN=${BOT_TOKEN}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    networks:
      - backend
    depends_on:
      - postgres
      - redis
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  nginx:
    image: nginx:alpine
    container_name: labeling-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/sites:/etc/nginx/sites-enabled
      - ./ssl:/etc/nginx/ssl
      - ./uploads:/var/www/uploads
    networks:
      - frontend
    depends_on:
      - backend
      - bot

  prometheus:
    image: prom/prometheus:latest
    container_name: labeling-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: labeling-grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning
    networks:
      - monitoring

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  backend:
    driver: bridge
  frontend:
    driver: bridge
  monitoring:
    driver: bridge
```

### Nginx Configuration

Create `nginx/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Include site configs
    include /etc/nginx/sites-enabled/*;
}
```

Create `nginx/sites/api.yourdomain.com`:

```nginx
upstream backend {
    server backend:3001;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS API endpoint
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/api.yourdomain.com.crt;
    ssl_certificate_key /etc/nginx/ssl/api.yourdomain.com.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # File uploads
    location /api/v1/tasks {
        limit_req zone=upload burst=5 nodelay;
        proxy_pass http://backend;
        proxy_request_buffering off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /uploads/ {
        alias /var/www/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        access_log off;
        proxy_pass http://backend/health;
    }
}
```

## Manual Deployment

### Backend Setup

```bash
# 1. Install dependencies
cd backend
npm install --production

# 2. Build application
npm run build

# 3. Setup PM2 (process manager)
npm install -g pm2

# 4. Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'labeling-api',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# 5. Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Bot Setup

```bash
# 1. Install dependencies
cd bot
npm install --production

# 2. Build application
npm run build

# 3. Create PM2 config
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'labeling-bot',
    script: './dist/index.js',
    instances: 1,
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '512M'
  }]
};
EOF

# 4. Start bot
pm2 start ecosystem.config.js
pm2 save
```

### Database Setup (PostgreSQL)

```bash
# 1. Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# 2. Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE labeling_platform;
CREATE USER labeling_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE labeling_platform TO labeling_user;
ALTER USER labeling_user CREATEDB;
\q
EOF

# 3. Configure PostgreSQL
sudo nano /etc/postgresql/16/main/postgresql.conf

# Edit these settings:
# listen_addresses = 'localhost'
# max_connections = 200
# shared_buffers = 256MB
# effective_cache_size = 1GB

# 4. Restart PostgreSQL
sudo systemctl restart postgresql
sudo systemctl enable postgresql

# 5. Run migrations
cd backend
npm run migrate

# 6. Seed initial data
npm run seed:prod
```

### Redis Setup

```bash
# 1. Install Redis
sudo apt install redis-server

# 2. Configure Redis
sudo nano /etc/redis/redis.conf

# Edit these settings:
# bind 127.0.0.1
# requirepass your_redis_password
# maxmemory 512mb
# maxmemory-policy allkeys-lru

# 3. Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# 4. Test Redis
redis-cli -a your_redis_password ping
```

## Cloud Deployment

### AWS ECS Deployment

1. **Create ECS Cluster**
```bash
aws ecs create-cluster --cluster-name labeling-platform
```

2. **Create Task Definitions**
```json
{
  "family": "labeling-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-registry/labeling-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/labeling-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

3. **Create Service**
```bash
aws ecs create-service \
  --cluster labeling-platform \
  --service-name backend-service \
  --task-definition labeling-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
```

### Google Cloud Run Deployment

```bash
# 1. Build and push image
gcloud builds submit --tag gcr.io/PROJECT-ID/labeling-backend

# 2. Deploy to Cloud Run
gcloud run deploy labeling-backend \
  --image gcr.io/PROJECT-ID/labeling-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=db-url:latest
```

### Azure Container Instances

```bash
# 1. Create resource group
az group create --name labeling-rg --location eastus

# 2. Deploy container
az container create \
  --resource-group labeling-rg \
  --name labeling-backend \
  --image your-registry/labeling-backend:latest \
  --cpu 2 \
  --memory 4 \
  --ports 3001 \
  --environment-variables NODE_ENV=production \
  --secure-environment-variables DATABASE_URL=$DATABASE_URL
```

## Configuration

### Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database migrated
- [ ] Redis configured
- [ ] Nginx configured
- [ ] Monitoring set up
- [ ] Backups configured
- [ ] Log rotation configured
- [ ] Security headers set
- [ ] Rate limiting configured
- [ ] Health checks enabled
- [ ] Error reporting configured

### Log Rotation

Create `/etc/logrotate.d/labeling-platform`:

```
/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 node node
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Systemd Service (Optional)

Create `/etc/systemd/system/labeling-platform.service`:

```ini
[Unit]
Description=Telegram Labeling Platform
After=network.target

[Service]
Type=forking
User=node
WorkingDirectory=/app
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 stop all
Restart=always

[Install]
WantedBy=multi-user.target
```

## Database Setup

### Migration Commands

```bash
# Run all migrations
npm run migrate

# Run specific migration
npm run migrate:up -- 001_create_users.sql

# Rollback migration
npm run migrate:down -- 001_create_users.sql

# Create new migration
npm run migration:create -- create_new_table

# Seed database
npm run seed:prod
```

### Database Optimization

```sql
-- Create indexes
CREATE INDEX CONCURRENTLY idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX CONCURRENTLY idx_task_results_created_at ON task_results(created_at);
CREATE INDEX CONCURRENTLY idx_users_telegram_id ON users(telegram_id);

-- Analyze tables
ANALYZE tasks;
ANALYZE task_results;
ANALYZE users;

-- Update statistics
ALTER DATABASE labeling_platform SET default_statistics_target = 100;
```

### Backup Script

Create `scripts/backup-db.sh`:

```bash
#!/bin/bash

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="labeling_platform"
RETENTION_DAYS=30

# Create backup
pg_dump -h localhost -U labeling_user -d $DB_NAME | gzip > $BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz

# Remove old backups
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Verify backup
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: db_backup_$TIMESTAMP.sql.gz"
else
    echo "Backup failed!"
    exit 1
fi
```

Add to crontab:
```bash
0 2 * * * /app/scripts/backup-db.sh
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# 1. Install Certbot
sudo apt install certbot python3-certbot-nginx

# 2. Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# 3. Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Manual SSL Certificate

```bash
# 1. Generate private key
openssl genrsa -out api.yourdomain.com.key 2048

# 2. Generate CSR
openssl req -new -key api.yourdomain.com.key -out api.yourdomain.com.csr

# 3. Submit CSR to your CA

# 4. Install certificates
sudo cp api.yourdomain.com.crt /etc/nginx/ssl/
sudo cp api.yourdomain.com.key /etc/nginx/ssl/
sudo chmod 600 /etc/nginx/ssl/api.yourdomain.com.key
```

## Monitoring Setup

### Prometheus Configuration

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'labeling-backend'
    static_configs:
      - targets: ['backend:9464']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Grafana Dashboards

Import pre-built dashboards:
- Node.js Application Dashboard
- PostgreSQL Dashboard
- Redis Dashboard
- Nginx Dashboard

### Alert Rules

Create `monitoring/rules/alerts.yml`:

```yaml
groups:
  - name: labeling-platform
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: "Error rate is {{ $value }} errors per second"

      - alert: DatabaseConnectionsHigh
        expr: pg_stat_activity_count > 180
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High database connections
          description: "Database has {{ $value }} connections"

      - alert: RedisMemoryHigh
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Redis memory usage high
          description: "Redis is using {{ $value | humanizePercentage }} of memory"
```

## Backup Strategy

### Automated Backups

```bash
#!/bin/bash
# backup-all.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/$TIMESTAMP"
mkdir -p $BACKUP_DIR

# Backup database
echo "Backing up database..."
docker exec labeling-postgres pg_dump -U labeling_user labeling_platform | gzip > $BACKUP_DIR/database.sql.gz

# Backup Redis
echo "Backing up Redis..."
docker exec labeling-redis redis-cli --rdb - | gzip > $BACKUP_DIR/redis.rdb.gz

# Backup uploads
echo "Backing up uploads..."
tar -czf $BACKUP_DIR/uploads.tar.gz /app/uploads

# Backup configuration
echo "Backing up configuration..."
tar -czf $BACKUP_DIR/config.tar.gz .env nginx/ monitoring/

# Upload to S3 (optional)
if [ ! -z "$AWS_S3_BUCKET" ]; then
    aws s3 sync $BACKUP_DIR s3://$AWS_S3_BUCKET/backups/$TIMESTAMP/
fi

# Clean up old backups (keep last 30 days)
find /backups -type d -mtime +30 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR"
```

### Recovery Procedures

1. **Database Recovery**
```bash
# Stop services
docker-compose stop backend bot

# Restore database
gunzip -c /backups/database.sql.gz | docker exec -i labeling-postgres psql -U labeling_user -d labeling_platform

# Start services
docker-compose start backend bot
```

2. **Full System Recovery**
```bash
# Extract backup
tar -xzf /backups/20240115_020000/config.tar.gz

# Restore database
docker-compose down
docker-compose up -d postgres redis
sleep 30
gunzip -c /backups/20240115_020000/database.sql.gz | docker exec -i labeling-postgres psql -U labeling_user -d labeling_platform

# Restore uploads
tar -xzf /backups/20240115_020000/uploads.tar.gz

# Start all services
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
```bash
# Check PostgreSQL status
docker-compose logs postgres

# Test connection
docker-compose exec backend npm run db:test

# Check network
docker network ls
docker network inspect telegram-labeling-platform_backend
```

2. **Redis Connection Failed**
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis

# Test from backend
docker-compose exec backend node -e "const redis = require('redis'); const client = redis.createClient({url: process.env.REDIS_URL}); client.connect().then(() => console.log('Connected'))"
```

3. **Bot Not Responding**
```bash
# Check bot token
curl https://api.telegram.org/bot$BOT_TOKEN/getMe

# Check bot logs
docker-compose logs bot

# Set webhook
curl -X POST https://api.telegram.org/bot$BOT_TOKEN/setWebhook -d "url=$BOT_WEBHOOK_URL"
```

4. **High Memory Usage**
```bash
# Check memory usage
docker stats

# Node.js heap dump
docker-compose exec backend kill -USR2 1

# PM2 monitoring
pm2 monit
```

### Performance Issues

1. **Slow API Response**
```bash
# Check database queries
docker-compose exec postgres psql -U labeling_user -d labeling_platform -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check slow queries
docker-compose exec postgres psql -U labeling_user -d labeling_platform -c "SELECT query, mean_time, calls FROM pg_stat_statements WHERE mean_time > 1000 ORDER BY mean_time DESC;"

# Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();
```

2. **High CPU Usage**
```bash
# Check processes
docker-compose exec backend ps aux

# Profile Node.js
docker-compose exec backend node --inspect dist/index.js

# Use clinic.js
npm install -g clinic
clinic doctor -- node dist/index.js
```

### Log Analysis

```bash
# Error logs
docker-compose logs backend | grep ERROR

# Recent requests
docker-compose logs --tail=1000 backend | grep "POST /api"

# Database errors
docker-compose logs postgres | grep ERROR

# Rate limit hits
grep "rate limit" /var/log/nginx/access.log | tail -100
```

### Health Checks

```bash
# API health
curl https://api.yourdomain.com/health

# Database health
docker-compose exec postgres pg_isready

# Redis health
docker-compose exec redis redis-cli ping

# Full health check script
#!/bin/bash
echo "Checking system health..."

# API
if curl -f https://api.yourdomain.com/health > /dev/null 2>&1; then
    echo "✓ API is healthy"
else
    echo "✗ API is down"
fi

# Database
if docker-compose exec -T postgres pg_isready > /dev/null 2>&1; then
    echo "✓ Database is healthy"
else
    echo "✗ Database is down"
fi

# Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✓ Redis is healthy"
else
    echo "✗ Redis is down"
fi

# Bot
if curl -f https://api.telegram.org/bot$BOT_TOKEN/getMe > /dev/null 2>&1; then
    echo "✓ Bot is healthy"
else
    echo "✗ Bot is down"
fi
```

### Getting Help

- **Documentation**: [docs.labelmint.it](https://docs.labelmint.it)
- **Status Page**: [status.labelmint.it](https://status.labelmint.it)
- **Support**: support@labelmint.it
- **GitHub Issues**: [github.com/labelmint/labeling-platform/issues](https://github.com/labelmint/labeling-platform/issues)
- **Community**: [discord.gg/labelmint](https://discord.gg/labelmint)