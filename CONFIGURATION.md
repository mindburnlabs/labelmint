# ⚙️ LabelMint Configuration Guide

Comprehensive configuration management guide covering environment setup, parameters, and configuration standards for the LabelMint platform.

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Environment Management](#environment-management)
3. [Application Configuration](#application-configuration)
4. [Database Configuration](#database-configuration)
5. [Service Configuration](#service-configuration)
6. [Infrastructure Configuration](#infrastructure-configuration)
7. [Security Configuration](#security-configuration)
8. [Development Configuration](#development-configuration)
9. [Production Configuration](#production-configuration)
10. [Environment Variables](#environment-variables)
11. [Configuration Validation](#configuration-validation)
12. [Best Practices](#best-practices)
13. [Troubleshooting](#troubleshooting)

## Configuration Overview

LabelMint uses a hierarchical configuration system with environment-specific settings, ensuring consistency across development, staging, and production environments.

### Configuration Hierarchy

```
Configuration Sources (Highest to Lowest Priority):
1. Environment Variables
2. .env.local files
3. Environment-specific .env files
4. Default .env file
5. Configuration files (JSON/YAML)
6. Default values in code
```

### Configuration Files Structure

```
labelmint/
├── .env.example                    # Template for all environments
├── .env.development.example         # Development template
├── .env.staging.example            # Staging template
├── .env.production.example         # Production template
├── config/
│   ├── default.json               # Default configuration
│   ├── development.json           # Development overrides
│   ├── staging.json               # Staging overrides
│   └── production.json            # Production overrides
├── apps/
│   └── web/.env.example           # Web app configuration
├── services/
│   ├── labeling-backend/.env.example
│   └── payment-backend/.env.example
└── infrastructure/
    ├── terraform/
    │   ├── dev.tfvars
    │   ├── staging.tfvars
    │   └── production.tfvars
    └── k8s/
        ├── development/
        ├── staging/
        └── production/
```

## Environment Management

### Environment Types

| Environment | Purpose | Configuration File | Domain |
|-------------|---------|-------------------|--------|
| **Development** | Local development | `.env.development` | localhost |
| **Staging** | Pre-production testing | `.env.staging` | staging.labelmint.it |
| **Production** | Live deployment | `.env.production` | labelmint.it |

### Environment Setup

#### Development Environment

```bash
# 1. Create environment file
cp .env.example .env.development

# 2. Configure local settings
cat > .env.development << EOF
# Environment
NODE_ENV=development
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://labelmint:password@localhost:5432/labelmint_dev
REDIS_URL=redis://localhost:6379

# API Configuration
API_PORT=3001
API_HOST=localhost

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Development Settings
ENABLE_DEBUG_LOGS=true
ENABLE_SWAGGER=true
ENABLE_CORS_ORIGIN=http://localhost:3000,http://localhost:3002
EOF
```

#### Staging Environment

```bash
# 1. Create environment file
cp .env.example .env.staging

# 2. Configure staging settings
cat > .env.staging << EOF
# Environment
NODE_ENV=staging
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@staging-db.labelmint.it:5432/labelmint_staging
REDIS_URL=redis://staging-redis.labelmint.it:6379

# API Configuration
API_PORT=3001
API_HOST=0.0.0.0

# External Services
TON_API_KEY=your-staging-ton-api-key
OPENAI_API_KEY=your-staging-openai-key
AWS_ACCESS_KEY_ID=your-staging-aws-key
AWS_SECRET_ACCESS_KEY=your-staging-aws-secret

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
EOF
```

#### Production Environment

```bash
# 1. Create environment file
cp .env.example .env.production

# 2. Configure production settings
cat > .env.production << EOF
# Environment
NODE_ENV=production
LOG_LEVEL=warn

# Database
DATABASE_URL=postgresql://user:password@prod-db.labelmint.it:5432/labelmint_prod
REDIS_URL=redis://prod-redis.labelmint.it:6379

# API Configuration
API_PORT=3001
API_HOST=0.0.0.0

# External Services
TON_API_KEY=your-production-ton-api-key
OPENAI_API_KEY=your-production-openai-key
AWS_ACCESS_KEY_ID=your-production-aws-key
AWS_SECRET_ACCESS_KEY=your-production-aws-secret

# Security
ENABLE_RATE_LIMITING=true
ENABLE_SECURITY_HEADERS=true
CORS_ORIGIN=https://labelmint.it,https://app.labelmint.it

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
SENTRY_ENABLED=true
EOF
```

## Application Configuration

### Core Application Settings

#### Base Configuration (config/default.json)

```json
{
  "app": {
    "name": "LabelMint",
    "version": "1.0.0",
    "description": "Telegram Data Labeling Platform"
  },
  "server": {
    "host": "0.0.0.0",
    "port": 3001,
    "timeout": 30000,
    "keepAlive": true,
    "compression": true
  },
  "database": {
    "connectionTimeout": 30000,
    "queryTimeout": 30000,
    "maxConnections": 20,
    "minConnections": 5,
    "idleTimeout": 10000
  },
  "redis": {
    "host": "localhost",
    "port": 6379,
    "retryDelayOnFailover": 100,
    "maxRetriesPerRequest": 3
  },
  "security": {
    "jwt": {
      "algorithm": "HS256",
      "expiresIn": "24h",
      "refreshExpiresIn": "7d"
    },
    "bcrypt": {
      "saltRounds": 12
    },
    "rateLimit": {
      "windowMs": 900000,
      "max": 100
    }
  },
  "features": {
    "telegramIntegration": true,
    "blockchainPayments": true,
    "analytics": true,
    "notifications": true
  }
}
```

#### Environment-Specific Overrides

**Development Configuration (config/development.json)**

```json
{
  "server": {
    "timeout": 60000,
    "cors": {
      "origin": ["http://localhost:3000", "http://localhost:3002"],
      "credentials": true
    }
  },
  "logging": {
    "level": "debug",
    "format": "dev",
    "colorize": true
  },
  "features": {
    "debugMode": true,
    "mockPayments": true,
    "disableAuth": false
  },
  "monitoring": {
    "enabled": true,
    "metrics": true,
    "healthCheck": true
  }
}
```

**Production Configuration (config/production.json)**

```json
{
  "server": {
    "timeout": 30000,
    "compression": true,
    "trustProxy": true
  },
  "logging": {
    "level": "warn",
    "format": "json",
    "colorize": false
  },
  "security": {
    "helmet": true,
    "rateLimit": {
      "windowMs": 900000,
      "max": 100
    },
    "cors": {
      "origin": ["https://labelmint.it", "https://app.labelmint.it"],
      "credentials": true
    }
  },
  "monitoring": {
    "enabled": true,
    "metrics": true,
    "tracing": true,
    "profiling": false
  }
}
```

### Configuration Loading

```typescript
// config/index.ts
import { config as dotenvConfig } from 'dotenv';
import { config as convictConfig } from 'convict';
import path from 'path';

// Load environment variables
dotenvConfig();

// Define configuration schema
const config = convictConfig({
  env: {
    doc: "The application environment",
    format: ["development", "staging", "production"],
    default: "development",
    env: "NODE_ENV"
  },

  port: {
    doc: "The port to bind",
    format: "port",
    default: 3001,
    env: "PORT"
  },

  database: {
    url: {
      doc: "Database connection URL",
      format: String,
      default: "postgresql://localhost:5432/labelmint",
      env: "DATABASE_URL"
    },
    pool: {
      min: {
        doc: "Minimum pool size",
        format: Number,
        default: 5
      },
      max: {
        doc: "Maximum pool size",
        format: Number,
        default: 20
      }
    }
  },

  redis: {
    url: {
      doc: "Redis connection URL",
      format: String,
      default: "redis://localhost:6379",
      env: "REDIS_URL"
    }
  },

  jwt: {
    secret: {
      doc: "JWT secret key",
      format: String,
      default: "change-me-in-production",
      env: "JWT_SECRET",
      sensitive: true
    },
    expiresIn: {
      doc: "JWT expiration time",
      format: String,
      default: "24h",
      env: "JWT_EXPIRES_IN"
    }
  }
});

// Load environment-specific configuration
const env = config.get('env');
config.loadFile(path.join(__dirname, `${env}.json`));

// Validate configuration
config.validate({ allowed: 'strict' });

export default config.getProperties();
```

## Database Configuration

### PostgreSQL Configuration

#### Connection Settings

```typescript
// lib/database.ts
import { Pool } from 'pg';
import config from '../config';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  pool: {
    min: number;
    max: number;
    idle: number;
    acquire: number;
    evict: number;
  };
}

const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'labelmint',
  username: process.env.DB_USER || 'labelmint',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production',
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '5'),
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idle: parseInt(process.env.DB_POOL_IDLE || '10000'),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || '60000'),
    evict: parseInt(process.env.DB_POOL_EVICT || '1000')
  }
};

// Create connection pool
const pool = new Pool({
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.username,
  password: dbConfig.password,
  ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
  min: dbConfig.pool.min,
  max: dbConfig.pool.max,
  idleTimeoutMillis: dbConfig.pool.idle,
  connectionTimeoutMillis: dbConfig.pool.acquire,
  evictionRunMillis: dbConfig.pool.evict
});

export default pool;
```

#### Prisma Configuration

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/@prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String   @id @default(cuid())
  telegramId        BigInt   @unique
  telegramUsername  String?
  email             String?  @unique
  role              UserRole @default(WORKER)
  status            UserStatus @default(ACTIVE)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  projects          Project[]
  taskSubmissions   TaskSubmission[]
  wallets           Wallet[]
  sessions          UserSession[]

  @@map("users")
}

model Project {
  id          String        @id @default(cuid())
  title       String
  description String?
  type        TaskType
  status      ProjectStatus @default(DRAFT)
  ownerId     String
  budget      Decimal?
  settings    Json?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // Relations
  owner       User          @relation(fields: [ownerId], references: [id])
  tasks       Task[]

  @@map("projects")
}
```

### Redis Configuration

```typescript
// lib/redis.ts
import Redis from 'ioredis';
import config from '../config';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  keepAlive: number;
}

const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000
};

// Create Redis client
const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  db: redisConfig.db,
  retryDelayOnFailover: redisConfig.retryDelayOnFailover,
  maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
  lazyConnect: redisConfig.lazyConnect,
  keepAlive: redisConfig.keepAlive,
  // Connection name for monitoring
  connectionName: `labelmint-${process.env.NODE_ENV}`
});

// Event listeners
redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

export default redis;
```

## Service Configuration

### API Server Configuration

```typescript
// config/api.ts
export interface APIConfig {
  server: {
    host: string;
    port: number;
    timeout: number;
    keepAlive: boolean;
    compression: boolean;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  security: {
    helmet: boolean;
    rateLimit: {
      windowMs: number;
      max: number;
      message: string;
    };
    csrf: boolean;
  };
  logging: {
    level: string;
    format: string;
    colorize: boolean;
    timestamp: boolean;
  };
}

export const apiConfig: APIConfig = {
  server: {
    host: process.env.API_HOST || '0.0.0.0',
    port: parseInt(process.env.API_PORT || '3001'),
    timeout: parseInt(process.env.API_TIMEOUT || '30000'),
    keepAlive: process.env.API_KEEP_ALIVE === 'true',
    compression: process.env.API_COMPRESSION !== 'false'
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  security: {
    helmet: process.env.HELMET_ENABLED !== 'false',
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      message: 'Too many requests from this IP'
    },
    csrf: process.env.CSRF_ENABLED === 'true'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    colorize: process.env.LOG_COLORIZE === 'true',
    timestamp: process.env.LOG_TIMESTAMP !== 'false'
  }
};
```

### WebSocket Configuration

```typescript
// config/websocket.ts
export interface WebSocketConfig {
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  pingTimeout: number;
  pingInterval: number;
  maxHttpBufferSize: number;
  transports: string[];
  allowEIO3: boolean;
}

export const websocketConfig: WebSocketConfig = {
  cors: {
    origin: process.env.WS_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: process.env.WS_CORS_CREDENTIALS === 'true'
  },
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000'),
  pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000'),
  maxHttpBufferSize: parseInt(process.env.WS_MAX_BUFFER_SIZE || '1e8'),
  transports: process.env.WS_TRANSPORTS?.split(',') || ['websocket', 'polling'],
  allowEIO3: process.env.WS_ALLOW_EIO3 !== 'false'
};
```

### Payment Service Configuration

```typescript
// config/payment.ts
export interface PaymentConfig {
  ton: {
    apiEndpoint: string;
    apiKey: string;
    testnet: boolean;
    timeout: number;
  };
  fees: {
    withdrawal: {
      ton: number;
      usdt: number;
    };
    processing: {
      percentage: number;
      minimum: number;
    };
  };
  limits: {
    minimumWithdrawal: {
      ton: number;
      usdt: number;
    };
    maximumWithdrawal: {
      ton: number;
      usdt: number;
    };
    dailyWithdrawal: {
      ton: number;
      usdt: number;
    };
  };
  security: {
    requireConfirmation: boolean;
    multiSigThreshold: number;
    fraudDetection: boolean;
  };
}

export const paymentConfig: PaymentConfig = {
  ton: {
    apiEndpoint: process.env.TON_API_ENDPOINT || 'https://toncenter.com/api/v2',
    apiKey: process.env.TON_API_KEY || '',
    testnet: process.env.TON_TESTNET === 'true',
    timeout: parseInt(process.env.TON_TIMEOUT || '30000')
  },
  fees: {
    withdrawal: {
      ton: parseFloat(process.env.TON_WITHDRAWAL_FEE || '0.01'),
      usdt: parseFloat(process.env.USDT_WITHDRAWAL_FEE || '1.0')
    },
    processing: {
      percentage: parseFloat(process.env.PROCESSING_FEE_PERCENTAGE || '0.02'),
      minimum: parseFloat(process.env.PROCESSING_FEE_MINIMUM || '0.1')
    }
  },
  limits: {
    minimumWithdrawal: {
      ton: parseFloat(process.env.MIN_WITHDRAWAL_TON || '0.1'),
      usdt: parseFloat(process.env.MIN_WITHDRAWAL_USDT || '1.0')
    },
    maximumWithdrawal: {
      ton: parseFloat(process.env.MAX_WITHDRAWAL_TON || '1000'),
      usdt: parseFloat(process.env.MAX_WITHDRAWAL_USDT || '10000')
    },
    dailyWithdrawal: {
      ton: parseFloat(process.env.DAILY_WITHDRAWAL_TON || '100'),
      usdt: parseFloat(process.env.DAILY_WITHDRAWAL_USDT || '1000')
    }
  },
  security: {
    requireConfirmation: process.env.REQUIRE_WITHDRAWAL_CONFIRMATION !== 'false',
    multiSigThreshold: parseFloat(process.env.MULTISIG_THRESHOLD || '100'),
    fraudDetection: process.env.FRAUD_DETECTION_ENABLED !== 'false'
  }
};
```

## Infrastructure Configuration

### Kubernetes Configuration

#### Namespace Configuration

```yaml
# infrastructure/k8s/production/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: labelmint-prod
  labels:
    name: labelmint-prod
    environment: production
    team: platform
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: labelmint-prod-quota
  namespace: labelmint-prod
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    persistentvolumeclaims: "10"
    services: "10"
    secrets: "20"
    configmaps: "20"
    count/services: "10"
    count/secrets: "20"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: labelmint-prod-limits
  namespace: labelmint-prod
spec:
  limits:
  - default:
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    type: Container
```

#### Deployment Configuration

```yaml
# infrastructure/k8s/production/deployments/api-server.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: labelmint-prod
  labels:
    app: api-server
    version: "{{ .Values.version }}"
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
        version: "{{ .Values.version }}"
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3001"
        prometheus.io/path: "/metrics"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: api-server
        image: "{{ .Values.apiImage }}"
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 3001
          protocol: TCP
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: labelmint-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: labelmint-secrets
              key: redis-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: labelmint-secrets
              key: jwt-secret
        - name: TON_API_KEY
          valueFrom:
            secretKeyRef:
              name: labelmint-secrets
              key: ton-api-key
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: http
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
          - name: uploads
            mountPath: /app/uploads
      volumes:
      - name: tmp
        emptyDir: {}
      - name: uploads
        persistentVolumeClaim:
          claimName: api-uploads-pvc
      imagePullSecrets:
      - name: ecr-pull-secret
      nodeSelector:
        node-type: application
      tolerations:
      - key: "application"
        operator: "Equal"
        value: "true"
        effect: "NoSchedule"
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              - labelSelector:
                  matchExpressions:
                  - key: app
                    operator: In
                    values:
                    - api-server
                topologyKey: kubernetes.io/hostname
```

### Terraform Configuration

#### Variables Configuration

```hcl
# infrastructure/terraform/production/variables.tf
variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "labelmint"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "eks_cluster_version" {
  description = "EKS cluster version"
  type        = string
  default     = "1.28"
}

variable "eks_node_instance_types" {
  description = "EKS node instance types"
  type        = list(string)
  default     = ["t3.large", "t3.xlarge"]
}

variable "eks_node_desired_capacity" {
  description = "Desired number of EKS nodes"
  type        = number
  default     = 3
}

variable "eks_node_max_capacity" {
  description = "Maximum number of EKS nodes"
  type        = number
  default     = 6
}

variable "eks_node_min_capacity" {
  description = "Minimum number of EKS nodes"
  type        = number
  default     = 2
}

variable "database_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.m6g.large"
}

variable "database_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 500
}

variable "database_max_allocated_storage" {
  description = "RDS maximum allocated storage in GB"
  type        = number
  default     = 1000
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.m6g.large"
}

variable "redis_num_cache_clusters" {
  description = "Number of Redis cache clusters"
  type        = number
  default     = 2
}
```

#### Environment-Specific Variables

```hcl
# infrastructure/terraform/production/terraform.tfvars
region                   = "us-east-1"
environment              = "production"
project_name             = "labelmint"

vpc_cidr                 = "10.0.0.0/16"
public_subnet_cidrs      = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
private_subnet_cidrs     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]

eks_cluster_version      = "1.28"
eks_node_instance_types  = ["t3.large", "t3.xlarge"]
eks_node_desired_capacity = 3
eks_node_max_capacity     = 6
eks_node_min_capacity     = 2

database_instance_class           = "db.m6g.large"
database_allocated_storage         = 500
database_max_allocated_storage     = 1000
database_backup_retention_period   = 30
database_backup_window            = "03:00-04:00"
database_maintenance_window       = "sun:04:00-sun:05:00"

redis_node_type          = "cache.m6g.large"
redis_num_cache_clusters = 2
redis_automatic_failover = true
redis_multi_az_enabled   = true
redis_transit_encryption = true
redis_at_rest_encryption = true

tags = {
  Environment = "production"
  Project     = "labelmint"
  Team        = "platform"
  ManagedBy   = "terraform"
}
```

## Security Configuration

### Security Headers

```typescript
// config/security.ts
export interface SecurityConfig {
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: string[];
        scriptSrc: string[];
        styleSrc: string[];
        imgSrc: string[];
        fontSrc: string[];
        connectSrc: string[];
      };
    };
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
  };
  rateLimiting: {
    global: {
      windowMs: number;
      max: number;
      message: string;
    };
    auth: {
      windowMs: number;
      max: number;
      message: string;
    };
    api: {
      windowMs: number;
      max: number;
      message: string;
    };
  };
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
  };
}

export const securityConfig: SecurityConfig = {
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://vercel.live"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://api.telegram.org", "https://toncenter.com"]
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  },
  rateLimiting: {
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: "Too many requests from this IP"
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      message: "Too many authentication attempts"
    },
    api: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60,
      message: "API rate limit exceeded"
    }
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16
  }
};
```

### JWT Configuration

```typescript
// config/jwt.ts
export interface JWTConfig {
  secret: string;
  algorithm: string;
  expiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
  clockTolerance: number;
}

export const jwtConfig: JWTConfig = {
  secret: process.env.JWT_SECRET || 'change-me-in-production',
  algorithm: 'HS256',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  issuer: process.env.JWT_ISSUER || 'labelmint',
  audience: process.env.JWT_AUDIENCE || 'labelmint-users',
  clockTolerance: parseInt(process.env.JWT_CLOCK_TOLERANCE || '0')
};
```

## Development Configuration

### Local Development Setup

```bash
#!/bin/bash
# scripts/setup-dev.sh

echo "🔧 Setting up development environment..."

# 1. Copy environment files
if [ ! -f .env.development ]; then
    cp .env.example .env.development
    echo "✅ Created .env.development file"
fi

# 2. Copy service-specific environment files
if [ ! -f services/labeling-backend/.env ]; then
    cp services/labeling-backend/.env.example services/labeling-backend/.env
    echo "✅ Created labeling-backend environment file"
fi

if [ ! -f services/payment-backend/.env ]; then
    cp services/payment-backend/.env.example services/payment-backend/.env
    echo "✅ Created payment-backend environment file"
fi

# 3. Create database
docker-compose -f docker-compose.dev.yml up -d postgres redis

# 4. Wait for database to be ready
echo "⏳ Waiting for database..."
sleep 10

# 5. Run migrations
cd services/labeling-backend
pnpm prisma migrate dev
pnpm prisma db seed
cd ../..

# 6. Install dependencies
pnpm install

echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.development with your local settings"
echo "2. Run 'pnpm run dev' to start the development server"
echo "3. Visit http://localhost:3002 to access the application"
```

### Development Docker Configuration

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: labelmint-postgres-dev
    environment:
      POSTGRES_DB: labelmint_dev
      POSTGRES_USER: labelmint
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U labelmint"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: labelmint-redis-dev
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: labelmint-minio-dev
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

## Production Configuration

### Production Environment Variables

```bash
#!/bin/bash
# scripts/setup-production.sh

echo "🚀 Setting up production environment..."

# 1. Create production environment file
if [ ! -f .env.production ]; then
    cat > .env.production << EOF
# Production Environment Configuration
NODE_ENV=production
LOG_LEVEL=warn

# Database Configuration
DATABASE_URL=postgresql://user:password@prod-db.labelmint.it:5432/labelmint_prod
REDIS_URL=redis://prod-redis.labelmint.it:6379

# API Configuration
API_HOST=0.0.0.0
API_PORT=3001

# Security Configuration
JWT_SECRET=\$(openssl rand -base64 32)
JWT_REFRESH_SECRET=\$(openssl rand -base64 32)
CORS_ORIGIN=https://labelmint.it,https://app.labelmint.it

# External Services
TON_API_KEY=your-production-ton-api-key
OPENAI_API_KEY=your-production-openai-key
AWS_ACCESS_KEY_ID=your-production-aws-key
AWS_SECRET_ACCESS_KEY=your-production-aws-secret
AWS_REGION=us-east-1

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
SENTRY_DSN=your-production-sentry-dsn

# Feature Flags
ENABLE_RATE_LIMITING=true
ENABLE_SECURITY_HEADERS=true
ENABLE_ANALYTICS=true
EOF

    echo "✅ Created .env.production file"
    echo "⚠️  Please update the placeholder values in .env.production"
fi

# 2. Generate secrets
echo "🔑 Generating secrets..."

# JWT Secrets
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env.production.local
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)" >> .env.production.local

# Database Secrets
echo "DB_PASSWORD=$(openssl rand -base64 32)" >> .env.production.local
echo "REDIS_PASSWORD=$(openssl rand -base64 32)" >> .env.production.local

echo "✅ Secrets generated in .env.production.local"

# 3. Validate configuration
echo "🔍 Validating configuration..."
node scripts/validate-config.js

echo "✅ Production environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Update placeholder values in .env.production"
echo "2. Upload .env.production.local to your secret manager"
echo "3. Run 'terraform apply' to provision infrastructure"
echo "4. Deploy application using the deployment scripts"
```

### Production Monitoring Configuration

```yaml
# infrastructure/monitoring/production/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'labelmint-production'
    region: 'us-east-1'

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'labelmint-web'
    static_configs:
      - targets: ['web-app:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s

  - job_name: 'labelmint-api'
    static_configs:
      - targets: ['api-server:3001']
    metrics_path: '/metrics'
    scrape_interval: 15s
    scrape_timeout: 10s

  - job_name: 'labelmint-payment'
    static_configs:
      - targets: ['payment-server:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
    scrape_timeout: 10s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
    scrape_interval: 30s

  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - labelmint-prod
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
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
        replacement: $1
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: kubernetes_pod_name
```

## Environment Variables

### Complete Environment Variable Reference

#### Application Configuration

```env
# Environment
NODE_ENV=development|staging|production
LOG_LEVEL=debug|info|warn|error

# Server Configuration
HOST=0.0.0.0
PORT=3001
TIMEOUT=30000

# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=labelmint
DB_USER=labelmint
DB_PASSWORD=password
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE=10000
DB_POOL_ACQUIRE=60000
DB_POOL_EVICT=1000

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_POOL_MIN=5
REDIS_POOL_MAX=20
```

#### Security Configuration

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-32-chars-min
JWT_REFRESH_SECRET=your-super-secret-refresh-key-32-chars
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=labelmint
JWT_AUDIENCE=labelmint-users
JWT_CLOCK_TOLERANCE=0

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3002
CORS_CREDENTIALS=true
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
RATE_LIMIT_AUTH_WINDOW=900000
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_API_WINDOW=60000
RATE_LIMIT_API_MAX=60

# Security Headers
HELMET_ENABLED=true
ENABLE_SECURITY_HEADERS=true
ENABLE_CSRF=false
```

#### External Services

```env
# TON Blockchain
TON_API_KEY=your-toncenter-api-key
TON_API_ENDPOINT=https://toncenter.com/api/v2
TON_TESTNET=false
TON_TIMEOUT=30000
TON_MERCHANT_ADDRESS=EQ...your-merchant-address
USDT_MASTER_CONTRACT=EQ...usdt-contract-address

# Payment Configuration
TON_WITHDRAWAL_FEE=0.01
USDT_WITHDRAWAL_FEE=1.0
PROCESSING_FEE_PERCENTAGE=0.02
PROCESSING_FEE_MINIMUM=0.1
MIN_WITHDRAWAL_TON=0.1
MIN_WITHDRAWAL_USDT=1.0
MAX_WITHDRAWAL_TON=1000
MAX_WITHDRAWAL_USDT=10000
DAILY_WITHDRAWAL_TON=100
DAILY_WITHDRAWAL_USDT=1000

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-openai-key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=4096
OPENAI_TEMPERATURE=0.7

# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=labelmint-files
AWS_S3_REGION=us-east-1
AWS_CLOUDFRONT_DOMAIN=cdn.labelmint.it
```

#### Telegram Configuration

```env
# Telegram Bots
TELEGRAM_BOT_TOKEN_CLIENT=your-client-bot-token
TELEGRAM_BOT_TOKEN_WORKER=your-worker-bot-token
TELEGRAM_WEB_APP_URL=https://app.labelmint.it
TELEGRAM_WORKER_WEB_APP_URL=https://workers.labelmint.it

# Telegram API Configuration
TELEGRAM_API_ENDPOINT=https://api.telegram.org
TELEGRAM_API_TIMEOUT=30000
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret
```

#### Monitoring & Observability

```env
# Prometheus
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9464
PROMETHEUS_PATH=/metrics

# Grafana
GRAFANA_ENABLED=true
GRAFANA_PORT=3003
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin123

# Sentry
SENTRY_ENABLED=true
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Logging
LOG_FORMAT=combined
LOG_COLORIZE=true
LOG_TIMESTAMP=true
LOG_FILE_ENABLED=true
LOG_FILE_PATH=/var/log/labelmint
LOG_FILE_MAX_SIZE=10m
LOG_FILE_MAX_FILES=5
```

#### Feature Flags

```env
# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_NOTIFICATIONS=true
ENABLE_REAL_TIME_UPDATES=true
ENABLE_BLOCKCHAIN_PAYMENTS=true
ENABLE_AI_ASSISTANCE=true
ENABLE_ADVANCED_ANALYTICS=true
ENABLE_MULTI_LANGUAGE=false
ENABLE_API_V2=false

# Development Features
DEBUG_MODE=false
ENABLE_SWAGGER=false
ENABLE_PLAYGROUND=false
MOCK_PAYMENTS=false
DISABLE_AUTH=false
```

## Configuration Validation

### Configuration Schema Validation

```typescript
// scripts/validate-config.js
import Joi from 'joi';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Define validation schema
const configSchema = Joi.object({
  // Required environment variables
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').required(),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),

  // Optional with defaults
  PORT: Joi.number().default(3001),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),

  // URLs and endpoints
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  API_BASE_URL: Joi.string().default('http://localhost:3001'),

  // External services
  TON_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),

  OPENAI_API_KEY: Joi.string().when('ENABLE_AI_ASSISTANCE', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),

  // Numeric values
  DB_POOL_MAX: Joi.number().integer().min(1).max(100).default(20),
  DB_POOL_MIN: Joi.number().integer().min(1).max(20).default(5),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),

  // Boolean flags
  ENABLE_ANALYTICS: Joi.boolean().default(true),
  ENABLE_SECURITY_HEADERS: Joi.boolean().default(true),
  ENABLE_CORS: Joi.boolean().default(true),

  // File paths
  LOG_FILE_PATH: Joi.string().default('/var/log/labelmint'),

  // Timeouts
  API_TIMEOUT: Joi.number().integer().min(1000).default(30000),
  DATABASE_TIMEOUT: Joi.number().integer().min(1000).default(30000),
});

// Validate configuration
const { error, value } = configSchema.validate(process.env, {
  allowUnknown: true,
  stripUnknown: true
});

if (error) {
  console.error('❌ Configuration validation failed:');
  console.error(error.details.map(detail => `- ${detail.message}`).join('\n'));
  process.exit(1);
}

console.log('✅ Configuration validation passed');

// Check critical production settings
if (value.NODE_ENV === 'production') {
  const criticalChecks = [
    { condition: value.JWT_SECRET.length >= 64, message: 'JWT_SECRET should be at least 64 characters in production' },
    { condition: !value.JWT_SECRET.includes('change-me'), message: 'JWT_SECRET should not use default value in production' },
    { condition: value.CORS_ORIGIN !== 'http://localhost:3000', message: 'CORS_ORIGIN should be set to production domains' },
    { condition: value.LOG_LEVEL !== 'debug', message: 'LOG_LEVEL should not be debug in production' }
  ];

  const failedChecks = criticalChecks.filter(check => !check.condition);
  if (failedChecks.length > 0) {
    console.error('❌ Critical production configuration issues:');
    failedChecks.forEach(check => console.error(`- ${check.message}`));
    process.exit(1);
  }
}

console.log('✅ Production configuration checks passed');
console.log('📊 Configuration summary:');
console.log(`- Environment: ${value.NODE_ENV}`);
console.log(`- Port: ${value.PORT}`);
console.log(`- Log Level: ${value.LOG_LEVEL}`);
console.log(`- Database Pool: ${value.DB_POOL_MIN}-${value.DB_POOL_MAX}`);
console.log(`- Rate Limit: ${value.RATE_LIMIT_MAX} requests/15min`);
```

### Runtime Configuration Validation

```typescript
// lib/config-validator.ts
import { z } from 'zod';

// Configuration schema using Zod
const ConfigSchema = z.object({
  env: z.enum(['development', 'staging', 'production']),
  port: z.number().min(1).max(65535),
  database: z.object({
    url: z.string().url(),
    pool: z.object({
      min: z.number().min(1),
      max: z.number().min(1),
      idle: z.number().min(0),
      acquire: z.number().min(0),
      evict: z.number().min(0)
    })
  }),
  redis: z.object({
    url: z.string().url(),
    options: z.object({
      retryDelayOnFailover: z.number().min(0),
      maxRetriesPerRequest: z.number().min(0),
      lazyConnect: z.boolean()
    })
  }),
  jwt: z.object({
    secret: z.string().min(32),
    algorithm: z.string(),
    expiresIn: z.string(),
    refreshExpiresIn: z.string(),
    issuer: z.string(),
    audience: z.string()
  }),
  security: z.object({
    cors: z.object({
      origin: z.union([z.string(), z.array(z.string())]),
      credentials: z.boolean()
    }),
    rateLimiting: z.object({
      windowMs: z.number().min(1000),
      max: z.number().min(1)
    })
  })
});

// Type inference
export type Config = z.infer<typeof ConfigSchema>;

// Validation function
export function validateConfig(config: unknown): Config {
  return ConfigSchema.parse(config);
}

// Runtime validation
export function validateRuntimeConfig(): void {
  try {
    validateConfig(process.env);
    console.log('✅ Runtime configuration is valid');
  } catch (error) {
    console.error('❌ Runtime configuration validation failed:', error);
    process.exit(1);
  }
}
```

## Best Practices

### 1. Environment Variable Management

- **Use descriptive names**: Clear, self-explanatory variable names
- **Group related variables**: Use consistent prefixes
- **Document all variables**: Include comments explaining purpose
- **Provide defaults**: sensible defaults for non-critical settings
- **Validate early**: Validate configuration on startup

### 2. Security Best Practices

- **Never commit secrets**: Use environment variables for sensitive data
- **Use strong secrets**: Minimum 32 characters for JWT secrets
- **Rotate secrets regularly**: Automated rotation for production
- **Environment-specific values**: Different secrets per environment
- **Encrypt sensitive data**: Use encryption for additional security

### 3. Configuration Organization

- **Separate concerns**: Keep related configuration together
- **Use configuration files**: Complex settings in JSON/YAML files
- **Layer configuration**: Base config with environment overrides
- **Document defaults**: Clearly explain default values
- **Version control**: Track configuration changes

### 4. Development Workflow

- **Template files**: Provide .env.example files
- **Setup scripts**: Automated environment setup
- **Validation scripts**: Early error detection
- **Local development**: Easy local setup process
- **Testing**: Test configuration validation

## Troubleshooting

### Common Configuration Issues

#### 1. Database Connection Issues

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Common solutions
# 1. Verify DATABASE_URL format
# 2. Check if database is running
# 3. Verify network connectivity
# 4. Check credentials
```

#### 2. Redis Connection Issues

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Common solutions
# 1. Check Redis URL format
# 2. Verify Redis server is running
# 3. Check firewall settings
# 4. Verify authentication
```

#### 3. Environment Variable Issues

```bash
# Check environment variables
env | grep DATABASE_URL

# Common solutions
# 1. Verify .env file exists
# 2. Check variable spelling
# 3. Ensure proper quoting
# 4. Verify loading order
```

#### 4. Port Conflicts

```bash
# Check port usage
lsof -i :3001

# Common solutions
# 1. Kill processes using the port
# 2. Change port number
# 3. Check for multiple instances
```

### Debug Configuration

```typescript
// lib/debug-config.ts
import config from './config';

export function debugConfig(): void {
  console.log('=== Configuration Debug ===');
  console.log('Environment:', config.env);
  console.log('Port:', config.port);
  console.log('Database URL:', config.database.url ? '***' : 'not set');
  console.log('Redis URL:', config.redis.url ? '***' : 'not set');
  console.log('JWT Secret:', config.jwt.secret ? '***' : 'not set');
  console.log('CORS Origin:', config.security.cors.origin);
  console.log('Rate Limit:', config.security.rateLimiting);
  console.log('=== End Configuration Debug ===');
}

// Usage
if (process.env.DEBUG_CONFIG === 'true') {
  debugConfig();
}
```

## Conclusion

This configuration guide provides a comprehensive approach to managing LabelMint's configuration across all environments. Key takeaways:

1. **Environment-specific configuration**: Different settings for each environment
2. **Security-first approach**: Proper secret management and validation
3. **Automation**: Scripts for setup and validation
4. **Documentation**: Clear explanation of all configuration options
5. **Validation**: Early detection of configuration issues
6. **Best practices**: Following industry standards for configuration management

### Configuration Success Criteria

- [ ] All environments have proper configuration
- [ ] Secrets are properly managed and secured
- [ ] Configuration validation passes
- [ ] Development setup is automated
- [ ] Production configuration is hardened
- [ ] Monitoring and alerting configured
- [ ] Documentation is complete and up-to-date

### Configuration Maintenance

- **Regular reviews**: Quarterly review of configuration settings
- **Secret rotation**: Automated rotation of sensitive values
- **Documentation updates**: Keep configuration docs current
- **Testing**: Test configuration changes in staging
- **Monitoring**: Monitor configuration-related issues

---

**Last Updated**: 2024-10-24
**Version**: 2.0
**Next Review**: 2025-01-24

This configuration guide should be updated whenever new configuration options are added, existing options change, or new best practices are identified.