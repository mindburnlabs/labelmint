# ⚙️ LabelMint Configuration

Centralized configuration management for the LabelMint platform, providing consistent and secure configuration across all environments and services.

## 🎯 Configuration Philosophy

LabelMint follows a **centralized configuration approach** with:
- **Environment-specific** configurations
- **Secure secrets management**
- **Type-safe** configuration validation
- **Hierarchical** configuration inheritance
- **Hot-reload** capabilities where applicable

## 📁 Configuration Structure

```
config/
├── README.md                 # This file
├── environment/              # Environment variables
│   ├── README.md            # Environment guide
│   ├── .env.development     # Development config
│   ├── .env.staging         # Staging config
│   ├── .env.production      # Production config
│   └── load-env.sh          # Environment loader script
├── docker/                  # Docker configurations
│   ├── README.md            # Docker setup guide
│   ├── docker-compose.yml   # Base Docker configuration
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   └── docker-compose.test.yml
├── monitoring/              # Monitoring configuration
│   ├── README.md            # Monitoring setup guide
│   ├── prometheus.yml/      # Prometheus configs
│   ├── grafana/             # Grafana dashboards
│   └── alertmanager.yml     # Alert management
└── shared/                  # Shared configuration files
    ├── database.json        # Database schemas
    ├── services.json        # Service definitions
    └── security.json        # Security policies
```

## 🔧 Environment Configuration

### Environment Variables Management

Centralized environment configuration with support for multiple environments:

```bash
# Load environment configuration
source config/environment/load-env.sh production

# Or use in scripts
source "$(dirname "$0")/../config/environment/load-env.sh" production
```

### Available Environments

| Environment | Purpose | Features |
|-------------|---------|----------|
| **Development** | Local development | Debug tools, verbose logging, mock services |
| **Testing** | Automated testing | Minimal services, predictable data, fast startup |
| **Staging** | Pre-production validation | Production-like setup, performance testing |
| **Production** | Live deployment | Optimized for performance, security hardening |

### Core Environment Variables

#### Application Configuration
```bash
# Core Settings
NODE_ENV=production
ENVIRONMENT=production
LOG_LEVEL=info
APP_VERSION=1.0.0
BUILD_DATE=2024-01-15T10:30:00Z
GIT_SHA=abc123def456

# Service URLs
WEB_APP_URL=https://app.labelmint.com
NEXT_PUBLIC_API_URL=https://api.labelmint.com
NEXT_PUBLIC_WS_URL=wss://api.labelmint.com
LABELING_API_URL=https://api.labelmint.com/labeling
PAYMENT_API_URL=https://api.labelmint.com/payments

# Service Ports
WEB_PORT=3000
API_GATEWAY_PORT=3104
LABELING_BACKEND_PORT=3101
PAYMENT_BACKEND_PORT=3103
CLIENT_BOT_PORT=3105
WORKER_BOT_PORT=3106
```

#### Database Configuration
```bash
# PostgreSQL
POSTGRES_DB=labelmint
POSTGRES_USER=labelmint_user
POSTGRES_PASSWORD=secure_password
POSTGRES_PORT=5432
DATABASE_URL=postgresql://labelmint_user:secure_password@localhost:5432/labelmint

# Redis
REDIS_PASSWORD=redis_password
REDIS_PORT=6379
REDIS_BOTS_PORT=6380
REDIS_URL=redis://localhost:6379
REDIS_BOTS_URL=redis://localhost:6380
```

#### Security Configuration
```bash
# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=7d
SESSION_SECRET=your-session-secret-key
BCRYPT_ROUNDS=12

# API Security
API_SECRET_KEY=your-api-secret-key
WEBHOOK_SECRET=your-webhook-secret-key
CORS_ORIGIN=https://app.labelmint.com

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key
ENCRYPTION_IV=your-16-character-initialization-vector
```

#### External Services
```bash
# TON Blockchain
TON_API_KEY=your-ton-api-key
TON_RPC_ENDPOINT=https://toncenter.com/api/v2/jsonRPC
TON_MERCHANT_ADDRESS=0:your-merchant-address
USDT_MASTER_CONTRACT=0:a1b2c3d4e5f6...

# Telegram
TELEGRAM_BOT_TOKEN_CLIENT=your-client-bot-token
TELEGRAM_BOT_TOKEN_WORKER=your-worker-bot-token
CLIENT_BOT_TOKEN=your-client-bot-token
WORKER_BOT_TOKEN=your-worker-bot-token

# Storage (MinIO/S3)
MINIO_ACCESS_KEY=your-minio-access-key
MINIO_SECRET_KEY=your-minio-secret-key
MINIO_ENDPOINT=localhost:9000
MINIO_REGION=us-east-1
MINIO_BUCKET=labelmint-storage
```

#### Monitoring & Observability
```bash
# Sentry
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=labelmint@1.0.0

# Prometheus
PROMETHEUS_PORT=9090
PROMETHEUS_ENABLED=true

# Grafana
GRAFANA_PORT=3001
GRAFANA_USER=admin
GRAFANA_PASSWORD=secure-grafana-password

# Loki
LOKI_PORT=3100
LOKI_ENABLED=true

# Tempo
TEMPO_PORT=3200
TEMPO_ENABLED=true
```

### Environment Loading Script

The `load-env.sh` script provides a unified way to load environment configurations:

```bash
#!/bin/bash
# config/environment/load-env.sh

set -euo pipefail

ENVIRONMENT=${1:-development}
ENV_FILE="config/environment/.env.${ENVIRONMENT}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Error: Environment file not found: $ENV_FILE"
    echo "Available environments: development, testing, staging, production"
    exit 1
fi

echo "🚀 Loading environment: $ENVIRONMENT"
set -a
source "$ENV_FILE"
set +a

echo "✅ Environment loaded successfully"
echo "🔧 Environment: $ENVIRONMENT"
echo "📊 Log Level: $LOG_LEVEL"
echo "🌐 App URL: $WEB_APP_URL"
```

## 🐳 Docker Configuration

### Multi-Environment Docker Compose

Support for different deployment scenarios with Docker Compose:

```yaml
# config/docker/docker-compose.yml (Base configuration)
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    ports:
      - "${MINIO_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  default:
    driver: bridge
```

### Environment-Specific Overrides

#### Development (`docker-compose.dev.yml`)
```yaml
version: '3.8'

services:
  postgres:
    environment:
      POSTGRES_DB: labelmint_dev
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password

  redis:
    command: redis-server --requirepass dev_password

  # Development tools
  redis-commander:
    image: rediscommander/redis-commander:latest
    environment:
      REDIS_HOSTS: local:redis:6379:0:redis_password
    ports:
      - "8081:8081"
    depends_on:
      - redis

  pgadmin:
    image: dpage/pgadmin4:latest
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL:-admin@example.com}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD:-admin}
    ports:
      - "5050:80"
    depends_on:
      - postgres
```

#### Production (`docker-compose.prod.yml`)
```yaml
version: '3.8'

services:
  postgres:
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    restart: unless-stopped

  redis:
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    restart: unless-stopped

  minio:
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
    restart: unless-stopped
```

### Docker Usage

```bash
# Development environment
docker-compose -f config/docker/docker-compose.yml \
               -f config/docker/docker-compose.dev.yml up -d

# Production environment
docker-compose -f config/docker/docker-compose.yml \
               -f config/docker/docker-compose.prod.yml up -d

# View logs
docker-compose -f config/docker/docker-compose.yml logs -f

# Stop services
docker-compose -f config/docker/docker-compose.yml down
```

## 📊 Monitoring Configuration

### Prometheus Configuration

Comprehensive monitoring configuration for all services:

```yaml
# config/monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: '${ENVIRONMENT:-development}'
    cluster: 'labelmint'

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # Application services
  - job_name: 'labeling-backend'
    static_configs:
      - targets: ['labeling-backend:3101']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'payment-backend'
    static_configs:
      - targets: ['payment-backend:3103']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:3104']
    metrics_path: '/metrics'
    scrape_interval: 10s

  # Infrastructure services
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  # Kubernetes (if applicable)
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
```

### Grafana Configuration

Pre-configured Grafana dashboards and datasources:

```json
{
  "dashboard": {
    "id": null,
    "title": "LabelMint Application Overview",
    "tags": ["labelmint", "application"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "yAxes": [
          {
            "label": "Requests/sec"
          }
        ]
      },
      {
        "id": 2,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "valueMaps": [
          {
            "value": "null",
            "text": "N/A"
          }
        ],
        "thresholds": "0.01,0.05"
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "5s"
  }
}
```

### AlertManager Configuration

Comprehensive alerting rules and routing:

```yaml
# config/monitoring/alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@labelmint.com'
  smtp_auth_username: 'alerts@labelmint.com'
  smtp_auth_password: 'your-smtp-password'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'

  - name: 'critical-alerts'
    email_configs:
      - to: 'on-call@labelmint.com'
        subject: '[CRITICAL] {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Labels: {{ range .Labels.SortedPairs }}{{ .Name }}={{ .Value }} {{ end }}
          {{ end }}
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts-critical'
        title: 'Critical Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'warning-alerts'
    email_configs:
      - to: 'devops@labelmint.com'
        subject: '[WARNING] {{ .GroupLabels.alertname }}'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts-warning'
```

## 🔐 Security Configuration

### Security Policies

Comprehensive security configuration across all components:

```json
{
  "security": {
    "authentication": {
      "jwt": {
        "algorithm": "HS256",
        "expiresIn": "7d",
        "issuer": "labelmint",
        "audience": "labelmint-users"
      },
      "password": {
        "minLength": 8,
        "requireUppercase": true,
        "requireLowercase": true,
        "requireNumbers": true,
        "requireSpecialChars": true,
        "saltRounds": 12
      },
      "session": {
        "maxAge": 86400000,
        "secure": true,
        "httpOnly": true,
        "sameSite": "strict"
      }
    },
    "authorization": {
      "roles": {
        "client": [
          "read:own_tasks",
          "write:own_tasks",
          "read:own_profile",
          "write:own_profile"
        ],
        "worker": [
          "read:available_tasks",
          "write:task_submissions",
          "read:own_earnings",
          "read:own_profile"
        ],
        "admin": [
          "read:all_tasks",
          "write:all_tasks",
          "read:all_users",
          "write:all_users",
          "read:analytics",
          "manage:payments"
        ]
      }
    },
    "cors": {
      "origin": ["https://app.labelmint.com", "https://admin.labelmint.com"],
      "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      "allowedHeaders": ["Content-Type", "Authorization"],
      "credentials": true
    },
    "rateLimiting": {
      "windowMs": 900000,
      "max": 100,
      "message": "Too many requests from this IP",
      "standardHeaders": true,
      "legacyHeaders": false
    }
  }
}
```

### Database Security

```sql
-- Security configuration for PostgreSQL
-- Create dedicated users with minimal privileges

-- Application user (read/write to app tables only)
CREATE USER labelmint_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE labelmint TO labelmint_app;
GRANT USAGE ON SCHEMA public TO labelmint_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO labelmint_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO labelmint_app;

-- Read-only user for analytics
CREATE USER labelmint_readonly WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE labelmint TO labelmint_readonly;
GRANT USAGE ON SCHEMA public TO labelmint_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO labelmint_readonly;

-- Enable row-level security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY user_own_data ON tasks
    FOR ALL TO labelmint_app
    USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_profile_access ON users
    FOR ALL TO labelmint_app
    USING (id = current_setting('app.current_user_id')::uuid);
```

## 🔧 Configuration Validation

### TypeScript Configuration Types

Type-safe configuration with validation:

```typescript
// config/shared/types.ts
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolSize: number;
  connectionTimeout: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetries: number;
  retryDelayOnFailover: number;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  corsOrigin: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
}

export interface MonitoringConfig {
  sentryDsn?: string;
  prometheusEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface AppConfig {
  environment: 'development' | 'testing' | 'staging' | 'production';
  nodeEnv: string;
  port: number;
  logLevel: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}
```

### Configuration Validation

```typescript
// config/shared/validation.ts
import Joi from 'joi';
import { AppConfig } from './types';

const configSchema = Joi.object<AppConfig>({
  environment: Joi.string()
    .valid('development', 'testing', 'staging', 'production')
    .required(),

  nodeEnv: Joi.string()
    .valid('development', 'production', 'test')
    .required(),

  port: Joi.number()
    .port()
    .required(),

  logLevel: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .required(),

  database: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().port().required(),
    database: Joi.string().required(),
    username: Joi.string().required(),
    password: Joi.string().required(),
    ssl: Joi.boolean().required(),
    poolSize: Joi.number().min(1).max(20).required(),
    connectionTimeout: Joi.number().min(1000).required(),
  }).required(),

  security: Joi.object({
    jwtSecret: Joi.string().min(32).required(),
    jwtExpiresIn: Joi.string().required(),
    bcryptRounds: Joi.number().min(10).max(15).required(),
    corsOrigin: Joi.array().items(Joi.string()).required(),
    rateLimitWindow: Joi.number().min(1000).required(),
    rateLimitMax: Joi.number().min(1).required(),
  }).required(),
});

export function validateConfig(config: unknown): AppConfig {
  const { error, value } = configSchema.validate(config);
  if (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }
  return value;
}
```

### Configuration Loading

```typescript
// config/shared/loader.ts
import dotenv from 'dotenv';
import { validateConfig } from './validation';
import { AppConfig } from './types';

export function loadConfig(environment?: string): AppConfig {
  // Load environment-specific .env file
  const envFile = `.env.${environment || process.env.NODE_ENV || 'development'}`;
  dotenv.config({ path: envFile });

  // Build configuration object
  const config: AppConfig = {
    environment: process.env.ENVIRONMENT as any || 'development',
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000'),
    logLevel: process.env.LOG_LEVEL || 'info',

    database: {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'labelmint',
      username: process.env.POSTGRES_USER || 'labelmint',
      password: process.env.POSTGRES_PASSWORD || '',
      ssl: process.env.DATABASE_SSL === 'true',
      poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
      connectionTimeout: parseInt(process.env.DATABASE_TIMEOUT || '10000'),
    },

    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    },

    security: {
      jwtSecret: process.env.JWT_SECRET || '',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
      corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    },

    monitoring: {
      sentryDsn: process.env.SENTRY_DSN,
      prometheusEnabled: process.env.PROMETHEUS_ENABLED === 'true',
      logLevel: process.env.LOG_LEVEL as any || 'info',
    },
  };

  // Validate configuration
  return validateConfig(config);
}
```

## 🚀 Configuration Usage

### In Applications

```typescript
// apps/web/src/config/index.ts
import { loadConfig } from '../../../config/shared/loader';

const config = loadConfig(process.env.ENVIRONMENT);

export default config;

// Usage in components
import config from '../config';

const apiUrl = config.environment === 'production'
  ? 'https://api.labelmint.com'
  : 'http://localhost:3101';
```

### In Services

```typescript
// services/labeling-backend/src/config/index.ts
import { loadConfig } from '../../../config/shared/loader';
import { connectDatabase } from '../database';
import { connectRedis } from '../redis';

const config = loadConfig(process.env.ENVIRONMENT);

export async function initializeServices() {
  // Connect to database
  const db = await connectDatabase(config.database);

  // Connect to Redis
  const redis = await connectRedis(config.redis);

  // Configure monitoring
  if (config.monitoring.sentryDsn) {
    initSentry(config.monitoring.sentryDsn);
  }

  return { db, redis, config };
}

export { config };
```

### Environment Switching

```bash
# Development
export ENVIRONMENT=development
pnpm run dev

# Staging
export ENVIRONMENT=staging
pnpm run build && pnpm run start

# Production
export ENVIRONMENT=production
pnpm run build && pnpm run start
```

## 🔄 Configuration Updates

### Hot Reload for Development

```typescript
// config/shared/hot-reload.ts
import chokidar from 'chokidar';
import { loadConfig } from './loader';

let currentConfig = loadConfig();

export function watchConfig() {
  if (process.env.NODE_ENV !== 'development') return;

  const watcher = chokidar.watch('.env*');

  watcher.on('change', () => {
    console.log('🔄 Configuration changed, reloading...');
    currentConfig = loadConfig();
    // Emit configuration change event
    process.emit('config:changed', currentConfig);
  });
}

export function getConfig() {
  return currentConfig;
}
```

### Configuration Changes in Production

1. **Update Environment Variables**
   ```bash
   # Update in production environment
   kubectl set env deployment/labelmint-web LOG_LEVEL=debug
   ```

2. **Restart Services**
   ```bash
   # Rolling restart to apply new configuration
   kubectl rollout restart deployment/labelmint-web
   ```

3. **Validate Configuration**
   ```bash
   # Check service health after configuration change
   curl -f https://api.labelmint.com/health
   ```

## 🧪 Configuration Testing

### Unit Tests

```typescript
// tests/config/validation.test.ts
import { validateConfig } from '../../config/shared/validation';

describe('Configuration Validation', () => {
  it('should validate correct configuration', () => {
    const validConfig = {
      environment: 'production',
      nodeEnv: 'production',
      port: 3000,
      logLevel: 'info',
      database: {
        host: 'localhost',
        port: 5432,
        database: 'labelmint',
        username: 'user',
        password: 'password',
        ssl: true,
        poolSize: 10,
        connectionTimeout: 10000,
      },
      security: {
        jwtSecret: 'super-secret-key-that-is-at-least-32-chars',
        jwtExpiresIn: '7d',
        bcryptRounds: 12,
        corsOrigin: ['https://app.labelmint.com'],
        rateLimitWindow: 900000,
        rateLimitMax: 100,
      },
      monitoring: {
        prometheusEnabled: true,
        logLevel: 'info',
      },
    };

    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  it('should reject invalid configuration', () => {
    const invalidConfig = {
      environment: 'invalid-env',
      port: 'not-a-number',
      // ... other invalid fields
    };

    expect(() => validateConfig(invalidConfig)).toThrow();
  });
});
```

### Integration Tests

```typescript
// tests/config/environment-loading.test.ts
import { execSync } from 'child_process';

describe('Environment Loading', () => {
  it('should load development environment', () => {
    const output = execSync('source config/environment/load-env.sh development && echo $ENVIRONMENT', {
      encoding: 'utf8'
    });

    expect(output.trim()).toBe('development');
  });

  it('should fail for invalid environment', () => {
    expect(() => {
      execSync('source config/environment/load-env.sh invalid-env', {
        encoding: 'utf8'
      });
    }).toThrow();
  });
});
```

## 📚 Best Practices

### Configuration Management
1. **Never commit secrets** to version control
2. **Use environment variables** for all configuration
3. **Validate configuration** at startup
4. **Document all configuration options**
5. **Use different values** for each environment
6. **Rotate secrets regularly** in production

### Security
1. **Encrypt sensitive data** at rest
2. **Use IAM roles** for AWS service access
3. **Implement audit logging** for configuration changes
4. **Use TLS** for all external communications
5. **Regular security reviews** of configuration

### Performance
1. **Cache configuration** after loading
2. **Minimize configuration lookups**
3. **Use connection pooling** for databases
4. **Optimize database queries** based on configuration
5. **Monitor configuration impact** on performance

## 🆘 Troubleshooting

### Common Issues

#### Environment Variables Not Loading
```bash
# Check if environment file exists
ls -la config/environment/.env.production

# Test environment loading
source config/environment/load-env.sh production
echo $DATABASE_URL
```

#### Database Connection Issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check database configuration
printenv | grep DATABASE
```

#### Service Configuration Errors
```bash
# Check service logs
docker-compose logs labeling-backend

# Validate configuration file
node -e "console.log(JSON.stringify(require('./config/loader').loadConfig(), null, 2))"
```

### Debug Commands

```bash
# Show current configuration
env | grep -E "(DATABASE|REDIS|JWT|PORT)"

# Test configuration validation
node -e "const config = require('./config/shared/loader'); config.loadConfig();"

# Check Docker configuration
docker-compose config

# Validate monitoring configuration
promtool check rules config/monitoring/prometheus/rules/*.yml
```

## 📄 License

Configuration code is licensed under the MIT License. See [LICENSE](../../LICENSE) file for details.

---

**🚀 Built with ❤️ by the LabelMint Team**

For secure, scalable, and maintainable configuration management.