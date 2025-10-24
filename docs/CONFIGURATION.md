# ⚙️ CONFIGURATION - Environment Setup & Management

Comprehensive configuration documentation for LabelMint platform, covering environment setup, configuration management, and operational parameters.

## 📋 Table of Contents

- [🎯 Configuration Overview](#-configuration-overview)
- [🌐 Environment Management](#-environment-management)
- [⚙️ Application Configuration](#️-application-configuration)
- [🗄️ Database Configuration](#️-database-configuration)
- [🔐 Security Configuration](#-security-configuration)
- [🚀 Infrastructure Configuration](#-infrastructure-configuration)
- [📊 Monitoring Configuration](#-monitoring-configuration)
- [🔧 Development Configuration](#-development-configuration)
- [📋 Environment Variables Reference](#-environment-variables-reference)
- [🔄 Configuration Management](#-configuration-management)
- [🔍 Validation & Testing](#-validation--testing)

---

## 🎯 Configuration Overview

### 🎯 Configuration Principles

LabelMint follows these configuration principles:

- **Environment-Based** - Separate configurations for each environment
- **12-Factor App** - Store configuration in environment variables
- **Security First** - Never commit secrets to version control
- **Validation** - Validate all configuration at startup
- **Documentation** - All configuration options documented
- **Defaults** - Sensible defaults for development

### 🎯 Configuration Hierarchy

```
1. Command Line Arguments (highest priority)
2. Environment Variables
3. Configuration Files (.env, config.json)
4. Default Values (lowest priority)
```

### 📊 Configuration Categories

- **Application Settings** - Core application behavior
- **Database Configuration** - Database connections and settings
- **Security Configuration** - Authentication, encryption, and security
- **External Services** - Third-party service integrations
- **Infrastructure Settings** - Deployment and infrastructure
- **Monitoring Configuration** - Logging, metrics, and alerting
- **Development Settings** - Development-specific configurations

---

## 🌐 Environment Management

### 🌐 Environment Strategy

| Environment | Purpose | Database | Cache | Domain | Monitoring |
|-------------|---------|----------|-------|---------|------------|
| **Development** | Local development | Local PostgreSQL | Local Redis | `localhost:3000` | Local Grafana |
| **Staging** | Pre-production testing | Staging RDS | Staging ElastiCache | `staging.labelmint.com` | Staging Grafana |
| **Production** | Live production | Production RDS | Production ElastiCache | `labelmint.com` | Production Grafana |
| **Disaster Recovery** | Backup site | DR RDS | DR ElastiCache | `dr.labelmint.com` | DR Grafana |

### 📁 Environment Structure

```
labelmint/
├── .env.example                    # Environment template
├── .env.local                      # Local development (git ignored)
├── .env.staging                    # Staging environment (encrypted)
├── .env.production                 # Production environment (encrypted)
├── config/
│   ├── development.json            # Development config
│   ├── staging.json                # Staging config
│   ├── production.json             # Production config
│   └── default.json                # Default config
├── docker/
│   ├── docker-compose.yml         # Local development
│   ├── docker-compose.staging.yml # Staging environment
│   └── docker-compose.prod.yml    # Production environment
└── k8s/
    ├── environments/
    │   ├── development/           # Development manifests
    │   ├── staging/               # Staging manifests
    │   └── production/            # Production manifests
    └── base/                      # Base manifests
```

### 🔧 Environment Setup

#### Development Environment

```bash
# Clone repository
git clone https://github.com/your-org/labelmint.git
cd labelmint

# Copy environment template
cp .env.example .env.local

# Install dependencies
pnpm install

# Start infrastructure services
docker-compose up -d postgres redis

# Run database migrations
pnpm run db:migrate

# Start development server
pnpm run dev
```

#### Staging Environment

```bash
# Configure AWS credentials
aws configure set profile.staging.aws_access_key_id YOUR_ACCESS_KEY
aws configure set profile.staging.aws_secret_access_key YOUR_SECRET_KEY
aws configure set profile.staging.region us-east-1

# Update kubeconfig
aws eks update-kubeconfig --name labelmint-staging --profile staging

# Deploy to staging
helm upgrade --install labelmint-staging ./helm/labelmint \
  --namespace staging \
  --create-namespace \
  --set environment=staging \
  --values config/staging.yaml
```

#### Production Environment

```bash
# Configure AWS credentials
aws configure set profile.production.aws_access_key_id YOUR_ACCESS_KEY
aws configure set profile.production.aws_secret_access_key YOUR_SECRET_KEY
aws configure set profile.production.region us-east-1

# Update kubeconfig
aws eks update-kubeconfig --name labelmint-production --profile production

# Deploy to production (blue-green)
./scripts/deploy-blue-green.sh production v1.2.3
```

---

## ⚙️ Application Configuration

### 📋 Configuration Schema

```typescript
// config/schema.ts
export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: string;
    port: number;
    logLevel: LogLevel;
    debug: boolean;
  };
  database: DatabaseConfig;
  redis: RedisConfig;
  auth: AuthConfig;
  services: ServiceConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
}

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  ssl: boolean;
  timeout: number;
  retries: number;
}

export interface RedisConfig {
  url: string;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  lazyConnect: boolean;
  keepAlive: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  sessionTimeout: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
}

export interface ServiceConfig {
  apiGateway: ServiceEndpoint;
  userService: ServiceEndpoint;
  taskService: ServiceEndpoint;
  paymentService: ServiceEndpoint;
  consensusService: ServiceEndpoint;
}

export interface ServiceEndpoint {
  url: string;
  timeout: number;
  retries: number;
  circuitBreaker: CircuitBreakerConfig;
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: MetricsConfig;
  logging: LoggingConfig;
  tracing: TracingConfig;
}

export interface SecurityConfig {
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  encryption: EncryptionConfig;
}
```

### 📋 Configuration Loader

```typescript
// config/loader.ts
import dotenv from 'dotenv';
import Joi from 'joi';
import { AppConfig } from './schema';

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: AppConfig;

  constructor() {
    this.loadEnvironmentVariables();
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  getConfig(): AppConfig {
    return this.config;
  }

  private loadEnvironmentVariables(): void {
    const env = process.env.NODE_ENV || 'development';

    // Load environment-specific .env file
    dotenv.config({ path: `.env.${env}` });

    // Load local .env file (should not be committed)
    dotenv.config({ path: '.env.local' });
  }

  private loadConfiguration(): AppConfig {
    const env = process.env.NODE_ENV || 'development';

    // Load base configuration
    const baseConfig = require('./default.json');

    // Load environment-specific configuration
    const envConfig = require(`./${env}.json`);

    // Merge configurations
    const mergedConfig = this.mergeConfigs(baseConfig, envConfig);

    // Override with environment variables
    return this.overrideWithEnvVars(mergedConfig);
  }

  private validateConfiguration(): void {
    const schema = Joi.object({
      app: Joi.object({
        name: Joi.string().required(),
        version: Joi.string().required(),
        environment: Joi.string().valid('development', 'staging', 'production').required(),
        port: Joi.number().integer().min(1000).max(65535).required(),
        logLevel: Joi.string().valid('debug', 'info', 'warn', 'error').required(),
        debug: Joi.boolean().required()
      }).required(),

      database: Joi.object({
        url: Joi.string().required(),
        poolSize: Joi.number().integer().min(1).max(100).required(),
        ssl: Joi.boolean().required(),
        timeout: Joi.number().integer().min(1000).required(),
        retries: Joi.number().integer().min(0).max(10).required()
      }).required(),

      // ... other validation rules
    });

    const { error } = schema.validate(this.config);
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
  }

  private mergeConfigs(base: any, override: any): any {
    return {
      ...base,
      ...override,
      services: {
        ...base.services,
        ...override.services
      },
      monitoring: {
        ...base.monitoring,
        ...override.monitoring
      }
    };
  }

  private overrideWithEnvVars(config: any): AppConfig {
    return {
      app: {
        ...config.app,
        name: process.env.APP_NAME || config.app.name,
        version: process.env.APP_VERSION || config.app.version,
        environment: process.env.NODE_ENV || config.app.environment,
        port: parseInt(process.env.PORT || config.app.port.toString()),
        logLevel: process.env.LOG_LEVEL || config.app.logLevel,
        debug: process.env.DEBUG === 'true'
      },
      database: {
        ...config.database,
        url: process.env.DATABASE_URL || config.database.url,
        poolSize: parseInt(process.env.DATABASE_POOL_SIZE || config.database.poolSize.toString()),
        ssl: process.env.DATABASE_SSL === 'true'
      },
      // ... other environment variable overrides
    };
  }
}
```

### 📋 Default Configuration

```json
// config/default.json
{
  "app": {
    "name": "LabelMint",
    "version": "1.0.0",
    "environment": "development",
    "port": 3000,
    "logLevel": "info",
    "debug": false
  },
  "database": {
    "url": "postgresql://labelmint:password@localhost:5432/labelmint",
    "poolSize": 10,
    "ssl": false,
    "timeout": 30000,
    "retries": 3
  },
  "redis": {
    "url": "redis://localhost:6379",
    "maxRetriesPerRequest": 3,
    "retryDelayOnFailover": 100,
    "lazyConnect": true,
    "keepAlive": 30000
  },
  "auth": {
    "jwtSecret": "your-jwt-secret",
    "jwtRefreshSecret": "your-jwt-refresh-secret",
    "sessionTimeout": 86400000,
    "maxLoginAttempts": 5,
    "lockoutDuration": 900000
  },
  "services": {
    "apiGateway": {
      "url": "http://localhost:3002",
      "timeout": 5000,
      "retries": 3,
      "circuitBreaker": {
        "enabled": true,
        "threshold": 5,
        "timeout": 60000
      }
    },
    "userService": {
      "url": "http://localhost:3003",
      "timeout": 5000,
      "retries": 3,
      "circuitBreaker": {
        "enabled": true,
        "threshold": 5,
        "timeout": 60000
      }
    },
    "taskService": {
      "url": "http://localhost:3004",
      "timeout": 5000,
      "retries": 3,
      "circuitBreaker": {
        "enabled": true,
        "threshold": 5,
        "timeout": 60000
      }
    },
    "paymentService": {
      "url": "http://localhost:3005",
      "timeout": 10000,
      "retries": 3,
      "circuitBreaker": {
        "enabled": true,
        "threshold": 3,
        "timeout": 120000
      }
    },
    "consensusService": {
      "url": "http://localhost:3006",
      "timeout": 5000,
      "retries": 3,
      "circuitBreaker": {
        "enabled": true,
        "threshold": 5,
        "timeout": 60000
      }
    }
  },
  "monitoring": {
    "enabled": true,
    "metrics": {
      "enabled": true,
      "port": 9090,
      "path": "/metrics",
      "labels": {
        "service": "labelmint",
        "version": "1.0.0"
      }
    },
    "logging": {
      "level": "info",
      "format": "json",
      "outputs": ["console"],
      "file": {
        "enabled": false,
        "path": "./logs",
        "maxSize": "100MB",
        "maxFiles": 10
      }
    },
    "tracing": {
      "enabled": false,
      "jaeger": {
        "endpoint": "http://localhost:14268/api/traces",
        "service": "labelmint"
      }
    }
  },
  "security": {
    "cors": {
      "origin": ["http://localhost:3000"],
      "credentials": true,
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "allowedHeaders": ["Content-Type", "Authorization"]
    },
    "rateLimit": {
      "enabled": true,
      "windowMs": 900000,
      "max": 100,
      "message": "Too many requests from this IP"
    },
    "encryption": {
      "algorithm": "aes-256-gcm",
      "keyLength": 32,
      "ivLength": 16,
      "tagLength": 16
    }
  }
}
```

---

## 🗄️ Database Configuration

### 🐘 PostgreSQL Configuration

#### Connection Configuration

```typescript
// config/database.ts
import { Pool, PoolConfig } from 'pg';

export class DatabaseConfig {
  private static pool: Pool;

  static getConnection(): Pool {
    if (!this.pool) {
      const config = ConfigLoader.getInstance().getConfig().database;

      const poolConfig: PoolConfig = {
        connectionString: config.url,
        max: config.poolSize,
        ssl: config.ssl ? {
          rejectUnauthorized: false
        } : false,
        connectionTimeoutMillis: config.timeout,
        idleTimeoutMillis: 30000,
        allowExitOnIdle: false
      };

      this.pool = new Pool(poolConfig);

      // Handle pool errors
      this.pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
      });
    }

    return this.pool;
  }

  static async testConnection(): Promise<boolean> {
    try {
      const pool = this.getConnection();
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  static async closeConnection(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
```

#### Migration Configuration

```typescript
// config/migrations.ts
export class MigrationConfig {
  static getMigrationsPath(): string {
    const env = process.env.NODE_ENV || 'development';
    return `./migrations/${env}`;
  }

  static getMigrationTable(): string {
    return 'schema_migrations';
  }

  static getMigrationConfig() {
    return {
      client: 'pg',
      connection: ConfigLoader.getInstance().getConfig().database.url,
      migrations: {
        directory: this.getMigrationsPath(),
        tableName: this.getMigrationTable(),
        extension: 'js'
      },
      seeds: {
        directory: './seeds'
      }
    };
  }
}
```

### 🔴 Redis Configuration

```typescript
// config/redis.ts
import Redis from 'ioredis';

export class RedisConfig {
  private static client: Redis;

  static getConnection(): Redis {
    if (!this.client) {
      const config = ConfigLoader.getInstance().getConfig().redis;

      this.client = new Redis(config.url, {
        maxRetriesPerRequest: config.maxRetriesPerRequest,
        retryDelayOnFailover: config.retryDelayOnFailover,
        lazyConnect: config.lazyConnect,
        keepAlive: config.keepAlive,
        // Connection settings
        connectTimeout: 10000,
        commandTimeout: 5000,
        // Retry strategy
        retryStrategy: (times) => {
          if (times > 10) {
            return null; // Stop retrying after 10 attempts
          }
          return Math.min(times * 1000, 30000); // Exponential backoff
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      this.client.on('connect', () => {
        console.log('Redis connected successfully');
      });
    }

    return this.client;
  }

  static async testConnection(): Promise<boolean> {
    try {
      const client = this.getConnection();
      await client.ping();
      return true;
    } catch (error) {
      console.error('Redis connection test failed:', error);
      return false;
    }
  }

  static async closeConnection(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}
```

---

## 🔐 Security Configuration

### 🔐 Authentication Configuration

```typescript
// config/auth.ts
import jwt from 'jsonwebtoken';

export class AuthConfig {
  private static readonly JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  private static readonly JWT_ISSUER = 'labelmint';
  private static readonly JWT_AUDIENCE = 'labelmint-users';

  static getAccessTokenConfig() {
    return {
      secret: this.JWT_ACCESS_SECRET,
      expiresIn: '15m',
      issuer: this.JWT_ISSUER,
      audience: this.JWT_AUDIENCE,
      algorithm: 'HS256' as const
    };
  }

  static getRefreshTokenConfig() {
    return {
      secret: this.JWT_REFRESH_SECRET,
      expiresIn: '7d',
      issuer: this.JWT_ISSUER,
      algorithm: 'HS256' as const
    };
  }

  static generateAccessToken(payload: any): string {
    const config = this.getAccessTokenConfig();
    return jwt.sign(payload, config.secret, {
      expiresIn: config.expiresIn,
      issuer: config.issuer,
      audience: config.audience,
      algorithm: config.algorithm
    });
  }

  static generateRefreshToken(payload: any): string {
    const config = this.getRefreshTokenConfig();
    return jwt.sign(payload, config.secret, {
      expiresIn: config.expiresIn,
      issuer: config.issuer,
      algorithm: config.algorithm
    });
  }
}
```

### 🔐 Encryption Configuration

```typescript
// config/encryption.ts
import crypto from 'crypto';

export class EncryptionConfig {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    return crypto.scryptSync(key, 'salt', this.KEY_LENGTH);
  }

  static encrypt(text: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipher(this.ALGORITHM, key);
    cipher.setAAD(Buffer.from('labelmint', 'utf8'));

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedData: string): string {
    const key = this.getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(this.ALGORITHM, key);
    decipher.setAAD(Buffer.from('labelmint', 'utf8'));
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### 🔐 CORS Configuration

```typescript
// config/cors.ts
import cors from 'cors';

export class CorsConfig {
  static getCorsOptions() {
    const config = ConfigLoader.getInstance().getConfig().security.cors;

    return {
      origin: (origin: string | undefined, callback: Function) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (config.origin.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: config.credentials,
      methods: config.methods,
      allowedHeaders: config.allowedHeaders,
      exposedHeaders: ['X-Total-Count'],
      maxAge: 86400 // 24 hours
    };
  }
}
```

---

## 🚀 Infrastructure Configuration

### 🐳 Docker Configuration

#### Development Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: labelmint-postgres-dev
    environment:
      POSTGRES_DB: labelmint
      POSTGRES_USER: labelmint
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U labelmint"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: labelmint-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: labelmint-web-dev
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://labelmint:password@postgres:5432/labelmint
      - REDIS_URL=redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: pnpm run dev

  admin:
    build:
      context: ./apps/admin
      dockerfile: Dockerfile.dev
    container_name: labelmint-admin-dev
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://labelmint:password@postgres:5432/labelmint
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./apps/admin:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: pnpm run dev

volumes:
  postgres_data:
  redis_data:
```

#### Production Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
```

### ☸️ Kubernetes Configuration

#### Namespace Configuration

```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: labelmint
  labels:
    name: labelmint
    environment: production
```

#### ConfigMap Configuration

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: labelmint-config
  namespace: labelmint
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"
  DATABASE_POOL_SIZE: "20"
  REDIS_MAX_RETRIES: "3"
  CORS_ORIGIN: "https://labelmint.com"
  RATE_LIMIT_MAX: "1000"
  RATE_LIMIT_WINDOW: "15m"
```

#### Secret Configuration

```yaml
# k8s/base/secrets.yaml (for illustration - use sealed secrets in production)
apiVersion: v1
kind: Secret
metadata:
  name: labelmint-secrets
  namespace: labelmint
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  JWT_ACCESS_SECRET: <base64-encoded-jwt-secret>
  JWT_REFRESH_SECRET: <base64-encoded-refresh-secret>
  ENCRYPTION_KEY: <base64-encoded-encryption-key>
  TELEGRAM_BOT_TOKEN: <base64-encoded-telegram-token>
  TON_API_KEY: <base64-encoded-ton-api-key>
```

#### Deployment Configuration

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: labelmint-web
  namespace: labelmint
  labels:
    app: labelmint-web
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: labelmint-web
  template:
    metadata:
      labels:
        app: labelmint-web
        version: v1
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: web
        image: labelmint/web:latest
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: labelmint-config
        - secretRef:
            name: labelmint-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {}
```

---

## 📊 Monitoring Configuration

### 📈 Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'labelmint-web'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - labelmint
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node-exporter'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: node-exporter
```

### 📊 Grafana Configuration

```json
{
  "dashboard": {
    "id": null,
    "title": "LabelMint Application Dashboard",
    "tags": ["labelmint"],
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
        "gridPos": {
          "x": 0,
          "y": 0,
          "w": 12,
          "h": 8
        },
        "lines": true,
        "linewidth": 2
      },
      {
        "id": 2,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "gridPos": {
          "x": 12,
          "y": 0,
          "w": 12,
          "h": 8
        }
      },
      {
        "id": 3,
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
        ],
        "gridPos": {
          "x": 0,
          "y": 8,
          "w": 12,
          "h": 8
        }
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

### 📊 Application Metrics

```typescript
// config/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsConfig {
  private static httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  });

  private static httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  });

  private static activeConnections = new Gauge({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections'
  });

  private static databaseConnections = new Gauge({
    name: 'database_connections_active',
    help: 'Number of active database connections'
  });

  static registerMetrics(): void {
    register.registerMetric(this.httpRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.databaseConnections);
  }

  static incrementHttpRequests(method: string, route: string, statusCode: number): void {
    this.httpRequestsTotal
      .labels(method, route, statusCode.toString())
      .inc();
  }

  static observeHttpRequestDuration(method: string, route: string, duration: number): void {
    this.httpRequestDuration
      .labels(method, route)
      .observe(duration);
  }

  static setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  static setDatabaseConnections(count: number): void {
    this.databaseConnections.set(count);
  }
}
```

---

## 🔧 Development Configuration

### 🔧 Development Tools Configuration

#### ESLint Configuration

```json
// .eslintrc.json
{
  "root": true,
  "env": {
    "node": true,
    "es2022": true
  },
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint", "import"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
      "newlines-between": "always"
    }]
  },
  "ignorePatterns": ["dist/", "node_modules/", "*.config.js"]
}
```

#### Prettier Configuration

```json
// .prettierrc.json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

#### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 🔧 Testing Configuration

#### Jest Configuration

```json
// jest.config.json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": ["<rootDir>/src", "<rootDir>/test"],
  "testMatch": [
    "**/__tests__/**/*.ts",
    "**/?(*.)+(spec|test).ts"
  ],
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  },
  "setupFilesAfterEnv": ["<rootDir>/test/setup.ts"]
}
```

#### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  }
});
```

---

## 📋 Environment Variables Reference

### 🎯 Core Application Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Application environment |
| `PORT` | No | `3000` | Application port |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |
| `APP_NAME` | No | `LabelMint` | Application name |
| `APP_VERSION` | No | `1.0.0` | Application version |

### 🗄️ Database Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `DATABASE_POOL_SIZE` | No | `10` | Database connection pool size |
| `DATABASE_SSL` | No | `false` | Use SSL for database connections |
| `DATABASE_TIMEOUT` | No | `30000` | Database connection timeout (ms) |

### 🔴 Redis Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | - | Redis connection string |
| `REDIS_MAX_RETRIES` | No | `3` | Maximum retry attempts |
| `REDIS_TIMEOUT` | No | `10000` | Connection timeout (ms) |

### 🔐 Security Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_ACCESS_SECRET` | Yes | - | JWT access token secret |
| `JWT_REFRESH_SECRET` | Yes | - | JWT refresh token secret |
| `ENCRYPTION_KEY` | Yes | - | Data encryption key |
| `CORS_ORIGIN` | No | `http://localhost:3000` | CORS allowed origins |
| `RATE_LIMIT_MAX` | No | `100` | Rate limit max requests |
| `RATE_LIMIT_WINDOW` | No | `15m` | Rate limit time window |

### 📱 External Service Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | - | Telegram bot token |
| `TELEGRAM_WEBHOOK_URL` | No | - | Telegram webhook URL |
| `TON_RPC_URL` | No | `https://toncenter.com/api/v2/jsonRPC` | TON RPC endpoint |
| `TON_API_KEY` | No | - | TON API key |
| `TON_CONTRACT_ADDRESS` | Yes | - | TON smart contract address |

### 📊 Monitoring Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | No | - | Sentry DSN for error tracking |
| `NEW_RELIC_LICENSE_KEY` | No | - | New Relic license key |
| `PROMETHEUS_PORT` | No | `9090` | Prometheus metrics port |
| `JAEGER_ENDPOINT` | No | - | Jaeger tracing endpoint |

### ☁️ AWS Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_REGION` | No | `us-east-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | Yes | - | AWS access key ID |
| `AWS_SECRET_ACCESS_KEY` | Yes | - | AWS secret access key |
| `S3_BUCKET_NAME` | Yes | - | S3 bucket name for assets |

---

## 🔄 Configuration Management

### 🔧 Environment Variable Management

#### Development Environment

```bash
# .env.local (git ignored)
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://labelmint:password@localhost:5432/labelmint
DATABASE_POOL_SIZE=5
DATABASE_SSL=false

# Redis
REDIS_URL=redis://localhost:6379

# Security (development values)
JWT_ACCESS_SECRET=dev-jwt-access-secret-change-in-production
JWT_REFRESH_SECRET=dev-jwt-refresh-secret-change-in-production
ENCRYPTION_KEY=dev-encryption-key-change-in-production

# External Services
TELEGRAM_BOT_TOKEN=your-dev-bot-token
TON_API_KEY=your-dev-ton-api-key

# Monitoring
SENTRY_DSN=your-dev-sentry-dsn
```

#### Production Environment

```bash
# Production environment variables (stored in AWS Secrets Manager)
{
  "NODE_ENV": "production",
  "PORT": "3000",
  "LOG_LEVEL": "info",

  "DATABASE_URL": "postgresql://user:pass@prod-db:5432/labelmint",
  "DATABASE_POOL_SIZE": "20",
  "DATABASE_SSL": "true",

  "REDIS_URL": "redis://prod-redis:6379",

  "JWT_ACCESS_SECRET": "production-jwt-access-secret",
  "JWT_REFRESH_SECRET": "production-jwt-refresh-secret",
  "ENCRYPTION_KEY": "production-encryption-key",

  "TELEGRAM_BOT_TOKEN": "production-telegram-bot-token",
  "TON_API_KEY": "production-ton-api-key",

  "SENTRY_DSN": "production-sentry-dsn",
  "NEW_RELIC_LICENSE_KEY": "production-newrelic-key",

  "AWS_REGION": "us-east-1",
  "S3_BUCKET_NAME": "labelmint-prod-assets"
}
```

### 🔧 Configuration Validation

```typescript
// config/validation.ts
import Joi from 'joi';
import { ConfigLoader } from './loader';

export class ConfigValidator {
  private static schema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'staging', 'production').required(),
    PORT: Joi.number().integer().min(1000).max(65535).default(3000),
    LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),

    DATABASE_URL: Joi.string().required(),
    DATABASE_POOL_SIZE: Joi.number().integer().min(1).max(100).default(10),
    DATABASE_SSL: Joi.boolean().default(false),

    REDIS_URL: Joi.string().required(),

    JWT_ACCESS_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    ENCRYPTION_KEY: Joi.string().min(32).required(),

    TELEGRAM_BOT_TOKEN: Joi.string().required(),
    TON_API_KEY: Joi.string().optional(),

    SENTRY_DSN: Joi.string().optional(),
    NEW_RELIC_LICENSE_KEY: Joi.string().optional()
  });

  static validate(): void {
    const { error, value } = this.schema.validate(process.env, {
      allowUnknown: true,
      stripUnknown: true
    });

    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    // Validate required environment-specific configurations
    this.validateEnvironmentSpecific(value.NODE_ENV);
  }

  private static validateEnvironmentSpecific(env: string): void {
    switch (env) {
      case 'production':
        this.validateProduction();
        break;
      case 'staging':
        this.validateStaging();
        break;
      case 'development':
        this.validateDevelopment();
        break;
    }
  }

  private static validateProduction(): void {
    const required = [
      'SENTRY_DSN',
      'DATABASE_SSL',
      'NEW_RELIC_LICENSE_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }
  }

  private static validateStaging(): void {
    const required = [
      'SENTRY_DSN'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required staging environment variables: ${missing.join(', ')}`);
    }
  }

  private static validateDevelopment(): void {
    // Development has minimal requirements
    console.log('Development environment validation passed');
  }
}
```

---

## 🔍 Validation & Testing

### 🔍 Configuration Testing

```typescript
// test/config.test.ts
import { ConfigLoader } from '../config/loader';
import { ConfigValidator } from '../config/validation';

describe('Configuration', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.DATABASE_URL;
  });

  test('should load default configuration', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    const config = ConfigLoader.getInstance().getConfig();

    expect(config.app.environment).toBe('development');
    expect(config.app.port).toBe(3000);
    expect(config.database.url).toBe('postgresql://test:test@localhost:5432/test');
  });

  test('should validate required configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'test-secret-that-is-long-enough';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-long-enough';
    process.env.ENCRYPTION_KEY = 'test-encryption-key-long-enough';
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';

    expect(() => ConfigValidator.validate()).not.toThrow();
  });

  test('should throw error for missing required configuration', () => {
    process.env.NODE_ENV = 'production';
    // Missing required DATABASE_URL

    expect(() => ConfigValidator.validate()).toThrow();
  });

  test('should override config with environment variables', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.PORT = '4000';
    process.env.LOG_LEVEL = 'debug';

    const config = ConfigLoader.getInstance().getConfig();

    expect(config.app.port).toBe(4000);
    expect(config.app.logLevel).toBe('debug');
  });
});
```

### 🔍 Database Connection Testing

```typescript
// test/database.test.ts
import { DatabaseConfig } from '../config/database';
import { RedisConfig } from '../config/redis';

describe('Database Configuration', () => {
  test('should test database connection', async () => {
    const isConnected = await DatabaseConfig.testConnection();
    expect(typeof isConnected).toBe('boolean');
  });

  test('should test Redis connection', async () => {
    const isConnected = await RedisConfig.testConnection();
    expect(typeof isConnected).toBe('boolean');
  });

  test('should handle connection failures gracefully', async () => {
    // Test with invalid database URL
    process.env.DATABASE_URL = 'postgresql://invalid:invalid@localhost:9999/invalid';

    const isConnected = await DatabaseConfig.testConnection();
    expect(isConnected).toBe(false);
  });
});
```

---

## 📞 Getting Help

For configuration issues:

- **🔧 Configuration Issues**: config@labelmint.com
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/your-org/labelmint/issues)
- **💬 Configuration Questions**: #config Slack channel
- **📖 Documentation**: [docs/configuration/](./docs/configuration/)
- **🚀 Deployment Issues**: deploy@labelmint.com

---

<div align="center">

**⚙️ Robust Configuration Management**

Made with ❤️ by the LabelMint Platform Team

Last updated: October 2024

</div>