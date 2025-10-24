# Production Deployment Guide

This guide provides step-by-step instructions for deploying Deligate.it to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Environment Setup](#environment-setup)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Post-Deployment](#post-deployment)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- **Docker** 20.10+ and **Docker Compose** 2.0+
- **Domain name** (e.g., labelmint.it)
- **SSL certificate** (Let's Encrypt recommended)
- **AWS Account** (for ECR if using AWS)
- **SSH access** to production server

## Server Requirements

### Minimum Requirements

- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **Network**: 100 Mbps bandwidth
- **OS**: Ubuntu 20.04+ or CentOS 8+

### Recommended Requirements

- **CPU**: 8 cores
- **RAM**: 16GB
- **Storage**: 100GB SSD
- **Network**: 1 Gbps bandwidth

## Environment Setup

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh | sh
sudo usermod -aG docker $USER
sudo systemctl enable docker
sudo systemctl start docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install additional tools
sudo apt install -y nginx certbot python3-certbot-nginx htop
```

### 2. Install Node.js

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm@9.15.1
```

### 3. Create Application Directory

```bash
sudo mkdir -p /opt/labelmint-it
sudo chown $USER:$USER /opt/labelmint-it
cd /opt/labelmint-it
```

## Configuration

### 1. Clone Repository

```bash
git clone https://github.com/your-org/labelmint.it.git .
```

### 2. Configure Environment Variables

Copy the production environment template and update it:

```bash
cp .env.production .env.local
```

Edit `.env.local` with your production values:

```bash
nano .env.local
```

**Critical variables to update:**

- `POSTGRES_PASSWORD` - Strong database password
- `REDIS_PASSWORD` - Strong Redis password
- `JWT_SECRET` - 32+ character random string
- `JWT_REFRESH_SECRET` - 32+ character random string
- `TON_API_KEY` - Your TON API key
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `OPENAI_API_KEY` - OpenAI API key
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `GRAFANA_PASSWORD` - Grafana admin password

### 3. Generate Secrets

Generate secure secrets:

```bash
# Generate JWT secrets
openssl rand -base64 32

# Generate database passwords
openssl rand -base64 32

# Generate Redis password
openssl rand -base64 32
```

## Deployment

### 1. Build and Deploy

```bash
# Deploy to production
./scripts/deployment/deploy-production.sh
```

### 2. Configure Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/labelmint.it
```

```nginx
server {
    listen 80;
    server_name labelmint.it www.labelmint.it;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name labelmint.it www.labelmint.it;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/labelmint.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/labelmint.it/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https: data: blob: 'unsafe-inline' https://app.labelmint.it" always;

    # Proxy to application
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Telegram app proxy
    location /telegram/ {
        proxy_pass http://localhost;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### 3. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/labelmint.it /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Setup SSL Certificate

```bash
# Get SSL certificate
sudo certbot --nginx -d labelmint.it -d www.labelmint.it

# Set up auto-renewal
sudo crontab -e
0 12 * * * /usr/bin/certbot renew --quiet
```

## Post-Deployment

### 1. Verify Deployment

```bash
# Run health check
./scripts/health-check.sh

# Check service logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 2. Setup Monitoring

1. **Grafana**: Access at `http://your-server:9090`
   - Login with credentials from `.env.local`
   - Import dashboards from `infrastructure/monitoring/grafana/dashboards`

2. **Prometheus**: Access at `http://your-server:9090`
   - Monitor service metrics
   - Set up alerting rules

### 3. Database Backups

Create backup script:

```bash
sudo nano /opt/labelmint-it/scripts/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/labelmint-it/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec labelmint-postgres-prod pg_dump -U labelmint labelmint_prod > $BACKUP_DIR/database_$DATE.sql

# Backup volumes
docker run --rm -v labelmint-postgres_prod_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/postgres_$DATE.tar.gz /data

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

Make it executable and set up cron job:

```bash
sudo chmod +x /opt/labelmint-it/scripts/backup.sh
sudo crontab -e
0 2 * * * /opt/labelmint-it/scripts/backup.sh
```

### 4. Log Rotation

Create logrotate configuration:

```bash
sudo nano /etc/logrotate.d/labelmint-it
```

```
/opt/labelmint-it/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker-compose -f /opt/labelmint-it/docker-compose.prod.yml restart
    endscript
}
```

## Monitoring

### 1. Health Monitoring

- **Application Health**: `https://labelmint.it/health`
- **Docker Services**: `docker-compose ps`
- **Resource Usage**: `docker stats`

### 2. Log Monitoring

- **Application Logs**: `docker-compose logs -f [service-name]`
- **Nginx Logs**: `sudo tail -f /var/log/nginx/error.log`
- **System Logs**: `sudo journalctl -f -u docker`

### 3. Performance Monitoring

- **CPU/Memory**: `htop`
- **Disk Usage**: `df -h`
- **Network**: `iftop`

## Troubleshooting

### Common Issues

#### 1. Services Not Starting

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs [service-name]

# Check resource usage
docker stats

# Restart services
docker-compose -f docker-compose.prod.yml restart [service-name]
```

#### 2. Database Connection Issues

```bash
# Check PostgreSQL status
docker exec labelmint-postgres-prod pg_isready -U labelmint

# Test connection
docker exec labelmint-postgres-prod psql -U labelmint -d labelmint_prod -c "SELECT 1;"
```

#### 3. High Memory Usage

```bash
# Check container resource usage
docker stats

# Clear Docker cache
docker system prune -a

# Restart affected services
docker-compose -f docker-compose.prod-compose.yml restart
```

#### 4. SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Reload Nginx
sudo systemctl reload nginx
```

### 5. Performance Issues

```bash
# Check system load
uptime

# Check memory usage
free -h

# Check disk I/O
iotop

# Check network connections
ss -tuln
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Use HTTPS everywhere
- [ ] Enable security headers
- [ ] Set up firewall rules
- [ ] Regular security updates
- [ ] Monitor access logs
- [ ] Use secrets management
- [ ] Enable database encryption
- [ ] Set up regular backups

## Rollback Procedure

If deployment fails:

```bash
# Rollback to previous version
docker-compose -f docker-compose.prod.yml down

# Restore backup
cd /opt/labelmint-it/backups
LATEST_BACKUP=$(ls -t database_*.sql | head -1)
docker exec -i labelmint-postgres-prod psql -U labelmint labelmint_prod < $LATEST_BACKUP

# Start previous version
docker-compose -f docker-compose.prod.yml up -d

# Verify health
./scripts/health-check.sh
```

## Support

For deployment issues:

1. Check the [GitHub Issues](https://github.com/your-org/labelmint.it/issues)
2. Review the [Troubleshooting Guide](../development/troubleshooting.md)
3. Contact the DevOps team at ops@labelmint.it