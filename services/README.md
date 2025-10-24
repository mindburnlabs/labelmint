# 🛠️ LabelMint Services

A comprehensive microservices architecture powering the LabelMint data labeling platform. Built for scalability, security, and exceptional performance with Node.js, TypeScript, and modern backend technologies.

## 🏗️ Architecture Overview

LabelMint services follow a **microservices architecture** pattern with clear separation of concerns, independent scaling, and fault isolation:

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                             │
│                   (Route & Load Balance)                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───▼────┐    ┌─────▼─────┐    ┌─────▼─────┐
│ Bots   │    │ Labeling  │    │ Payment   │
│ Service│    │ Backend   │    │ Backend   │
└────────┘    └───────────┘    └───────────┘
    │                 │                 │
    ▼                 ▼                 ▼
┌─────────┐    ┌─────────────┐    ┌─────────────┐
│ Redis   │    │ PostgreSQL  │    │ TON Network │
│ (Queue) │    │ (Database)  │    │ (Blockchain)│
└─────────┘    └─────────────┘    └─────────────┘
```

## 📦 Service Catalog

### 🤖 Bots Service (`services/bots`)
**Core Functionality**: Telegram bot integration and user interaction management

**Features:**
- **Multi-bot Architecture** (Client & Worker bots)
- **Command Processing** with natural language understanding
- **User Authentication** via Telegram OAuth
- **Real-time Notifications** and updates
- **Webhook Management** for event handling
- **Rate Limiting** and spam protection
- **Message Queue Integration** for async processing

**Technology Stack:**
- **Node.js** with Express.js
- **Telegraf.js** for Telegram Bot API
- **TypeScript** for type safety
- **Redis** for caching and queues
- **PostgreSQL** for user data

**Key Endpoints:**
```typescript
// Webhook endpoints
POST /webhooks/client-bot    // Client bot events
POST /webhooks/worker-bot    // Worker bot events

// Bot management
GET  /api/bots/status        // Service health
POST /api/bots/broadcast     // Send notifications
GET  /api/bots/stats         // Bot statistics
```

**Quick Start:**
```bash
cd services/bots
pnpm install
pnpm dev
# Service runs on port 3105/3106
```

### 🏷️ Labeling Backend (`services/labeling-backend`)
**Core Functionality**: Task management, data processing, and quality control

**Features:**
- **Task Management** with complex workflows
- **AI-Powered Assistance** for labeling efficiency
- **Quality Control** with consensus mechanisms
- **File Processing** and image handling
- **Real-time Collaboration** for teams
- **Performance Analytics** and insights
- **Batch Processing** for large datasets

**Technology Stack:**
- **Node.js** with Express.js
- **PostgreSQL** for data persistence
- **Redis** for caching and sessions
- **Sharp** for image processing
- **Prisma** for database ORM
- **MinIO** for object storage

**Key Features:**
```typescript
// Task management
POST /api/tasks              // Create new task
GET  /api/tasks/:id          // Get task details
PUT  /api/tasks/:id          // Update task
POST /api/tasks/:id/submit   // Submit labeling result

// Quality control
GET  /api/quality/review     // Review queue
POST /api/quality/consensus  // Consensus checking
GET  /api/quality/metrics    // Quality metrics
```

**Documentation:**
- [File Management Guide](./labeling-backend/docs/FILE_MANAGEMENT.md)

**Quick Start:**
```bash
cd services/labeling-backend
pnpm install
pnpm dev
# Service runs on port 3101
```

### 💳 Payment Backend (`services/payment-backend`)
**Core Functionality**: TON blockchain integration and USDT payment processing

**Features:**
- **TON Blockchain Integration** for USDT payments
- **Smart Contract Interaction** with escrow functionality
- **Payment Processing** with automated verification
- **Wallet Management** for users
- **Transaction History** and reporting
- **Dispute Resolution** with escrow release
- **Multi-currency Support** (USDT, TON)

**Technology Stack:**
- **Node.js** with Express.js
- **TON SDK** for blockchain interaction
- **PostgreSQL** for transaction data
- **Redis** for caching
- **Web3 Libraries** for smart contracts

**Key Features:**
```typescript
// Payment processing
POST /api/payments/create    // Create payment
GET  /api/payments/:id       // Get payment status
POST /api/payments/verify    // Verify transaction
POST /api/payments/withdraw  // Process withdrawal

// Wallet management
POST /api/wallets/create     // Create wallet
GET  /api/wallets/:id        // Get wallet balance
POST /api/wallets/transfer   // Transfer funds
```

**Documentation:**
- [Performance Optimization Guide](./payment-backend/docs/performance-optimization.md)

**Quick Start:**
```bash
cd services/payment-backend
pnpm install
pnpm dev
# Service runs on port 3103
```

### 🚪 API Gateway (`services/api-gateway`)
**Core Functionality**: Central routing, authentication, and request orchestration

**Features:**
- **Request Routing** to backend services
- **Authentication & Authorization** with JWT
- **Rate Limiting** and DDoS protection
- **Request/Response Transformation**
- **API Versioning** and deprecation
- **CORS Management** and security headers
- **Load Balancing** and health checks

**Technology Stack:**
- **Node.js** with Express.js
- **Express Gateway** for API management
- **Redis** for rate limiting cache
- **JWT** for authentication
- **Helmet** for security

**Key Features:**
```typescript
// Gateway endpoints (routes to services)
/api/v1/tasks/*              // -> Labeling Backend
/api/v1/payments/*           // -> Payment Backend
/api/v1/auth/*               // -> Authentication Service
/api/v1/users/*              // -> User Service

// Gateway management
GET  /api/gateway/health     // Gateway health
GET  /api/gateway/metrics    // Performance metrics
```

**Quick Start:**
```bash
cd services/api-gateway
pnpm install
pnpm dev
# Service runs on port 3104
```

### 📊 Analytics Engine (`services/analytics-engine`)
**Core Functionality**: Data aggregation, business intelligence, and reporting

**Features:**
- **Real-time Analytics** processing
- **Business Intelligence** and dashboards
- **Custom Reports** generation
- **Data Aggregation** from multiple sources
- **Performance Metrics** tracking
- **User Behavior Analytics**
- **Financial Reporting** and insights

**Technology Stack:**
- **Node.js** with Express.js
- **ClickHouse** for analytics database
- **Redis** for caching
- **Apache Kafka** for data streaming
- **Grafana** for visualization

**Quick Start:**
```bash
cd services/analytics-engine
pnpm install
pnpm dev
# Service runs on port 3107
```

### 🤝 Collaboration Service (`services/collaboration-service`)
**Core Functionality**: Team management and collaborative features

**Features:**
- **Team Management** with roles and permissions
- **Real-time Collaboration** via WebSockets
- **Project Sharing** and access control
- **Communication Tools** (chat, comments)
- **Activity Feeds** and notifications
- **Workflow Management** for teams
- **Version Control** for labeled data

**Technology Stack:**
- **Node.js** with Express.js
- **Socket.io** for real-time features
- **PostgreSQL** for collaboration data
- **Redis** for real-time caching

**Quick Start:**
```bash
cd services/collaboration-service
pnpm install
pnpm dev
# Service runs on port 3108
```

### 🏢 Enterprise API (`services/enterprise-api`)
**Core Functionality**: Enterprise-specific features and integrations

**Features:**
- **SSO Integration** with enterprise providers
- **Advanced Analytics** for enterprise clients
- **Custom Workflows** and automation
- **API Rate Limiting** per organization
- **White-label Solutions**
- **Compliance Reporting** (SOC 2, GDPR)
- **Audit Trails** and logging

**Technology Stack:**
- **Node.js** with Express.js
- **Passport.js** for SSO integration
- **PostgreSQL** for enterprise data
- **Elasticsearch** for advanced search
- **Custom Auth Providers**

**Quick Start:**
```bash
cd services/enterprise-api
pnpm install
pnpm dev
# Service runs on port 3109
```

### ⚙️ Workflow Engine (`services/workflow-engine`)
**Core Functionality**: Business process automation and workflow management

**Features:**
- **Workflow Definition** with visual editor
- **Process Automation** with triggers
- **Task Assignment** and routing
- **Approval Workflows** for quality control
- **Integration Hooks** with external services
- **Performance Monitoring** and optimization
- **Custom Actions** and extensions

**Technology Stack:**
- **Node.js** with Express.js
- **BPMN** for workflow modeling
- **PostgreSQL** for workflow data
- **Redis** for state management
- **Message Queues** for async processing

**Quick Start:**
```bash
cd services/workflow-engine
pnpm install
pnpm dev
# Service runs on port 3110
```

### 🏷️ White-label Service (`services/white-label-service`)
**Core Functionality**: Custom branding and white-label solutions

**Features:**
- **Custom Branding** (logos, colors, themes)
- **Domain Management** for white-label instances
- **Feature Toggling** per organization
- **Custom Workflows** for specific industries
- **API Endpoint** customization
- **Analytics Isolation** per client
- **Multi-tenant Architecture**

**Technology Stack:**
- **Node.js** with Express.js
- **PostgreSQL** for tenant data
- **Redis** for multi-tenant caching
- **CDN Integration** for assets
- **Theme Engine** for customization

**Quick Start:**
```bash
cd services/white-label-service
pnpm install
pnpm dev
# Service runs on port 3111
```

## 🔧 Shared Infrastructure

### 📚 Technology Stack

| Technology | Purpose | Services Using |
|------------|---------|----------------|
| **Node.js** | Runtime Environment | All Services |
| **TypeScript** | Type Safety | All Services |
| **Express.js** | Web Framework | Most Services |
| **PostgreSQL** | Primary Database | All Services |
| **Redis** | Caching & Queues | All Services |
| **Prisma** | Database ORM | Labeling, Payment |
| **JWT** | Authentication | All Services |
| **Docker** | Containerization | All Services |

### 🔌 Inter-Service Communication

#### Synchronous Communication
- **HTTP/REST APIs** for direct service calls
- **GraphQL** for complex queries
- **gRPC** for high-performance internal communication

#### Asynchronous Communication
- **Redis Pub/Sub** for real-time events
- **Apache Kafka** for event streaming
- **Message Queues** for background processing
- **WebSockets** for real-time updates

#### Service Discovery
- **Consul** for service registration
- **Health Checks** for monitoring
- **Load Balancing** for high availability

### 🛡️ Security Architecture

#### Authentication & Authorization
```typescript
// JWT-based authentication
interface JWTPayload {
  userId: string;
  role: 'client' | 'worker' | 'admin';
  permissions: string[];
  organizationId?: string;
  iat: number;
  exp: number;
}

// Service-to-service authentication
interface ServiceAuth {
  serviceId: string;
  apiKey: string;
  permissions: ServicePermission[];
}
```

#### Security Measures
- **API Gateway** as security perimeter
- **Rate Limiting** per user and service
- **Input Validation** with schemas
- **SQL Injection Prevention** with parameterized queries
- **XSS Protection** with output encoding
- **CORS Configuration** for cross-origin requests
- **Security Headers** with Helmet.js

### 📊 Monitoring & Observability

#### Application Monitoring
- **Health Checks** for all services
- **Performance Metrics** with Prometheus
- **Distributed Tracing** with Jaeger
- **Error Tracking** with Sentry
- **Log Aggregation** with ELK Stack

#### Infrastructure Monitoring
- **Container Monitoring** with cAdvisor
- **System Metrics** with Node Exporter
- **Database Performance** with pgBouncer
- **Redis Monitoring** with Redis Exporter
- **Network Monitoring** with custom exporters

#### Alerting
```typescript
// Alert configuration
interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  duration: string;
  severity: 'critical' | 'warning' | 'info';
  channels: NotificationChannel[];
}
```

## 🚀 Development Workflow

### 1. Environment Setup
```bash
# Clone repository
git clone https://github.com/your-org/labelmint.git
cd labelmint

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Configure database, Redis, and other services
```

### 2. Development Mode
```bash
# Start all services
pnpm run dev:services

# Start specific service
pnpm run dev:service-labeling
pnpm run dev:service-payment
pnpm run dev:service-bots

# Start with Docker Compose
docker-compose -f docker-compose.dev.yml up
```

### 3. Database Management
```bash
# Run migrations
pnpm run db:migrate

# Seed development data
pnpm run db:seed

# Reset database
pnpm run db:reset
```

### 4. Testing
```bash
# Run all service tests
pnpm run test:services

# Run specific service tests
pnpm run test:labeling-backend
pnpm run test:payment-backend

# Integration tests
pnpm run test:integration

# E2E tests
pnpm run test:e2e
```

## 📦 Package Management

### Monorepo Structure
```
services/
├── package.json                 # Root service dependencies
├── pnpm-workspace.yaml         # PNPM workspace configuration
├── shared/                     # Shared libraries
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Shared utilities
│   ├── constants/              # Shared constants
│   └── validators/             # Shared validation schemas
├── bots/                       # Telegram bot service
├── labeling-backend/           # Task management service
├── payment-backend/            # Payment processing service
├── api-gateway/                # API gateway service
├── analytics-engine/           # Analytics service
├── collaboration-service/      # Collaboration features
├── enterprise-api/             # Enterprise features
├── workflow-engine/            # Workflow automation
└── white-label-service/        # White-label solutions
```

### Shared Dependencies
```json
{
  "dependencies": {
    "@labelmint/shared-types": "workspace:*",
    "@labelmint/shared-utils": "workspace:*",
    "@labelmint/shared-constants": "workspace:*",
    "@labelmint/shared-validators": "workspace:*"
  }
}
```

## 🔧 Configuration Management

### Environment Variables
```bash
# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/labelmint
REDIS_URL=redis://localhost:6379

# Service Configuration
API_GATEWAY_PORT=3104
LABELING_BACKEND_PORT=3101
PAYMENT_BACKEND_PORT=3103
BOTS_CLIENT_PORT=3105
BOTS_WORKER_PORT=3106

# Security
JWT_SECRET=your-jwt-secret
API_SECRET_KEY=your-api-secret

# External Services
TON_API_KEY=your-ton-api-key
TELEGRAM_BOT_TOKEN=your-bot-token
MINIO_ACCESS_KEY=your-minio-key
```

### Service Configuration
```typescript
// shared/config/services.ts
export const serviceConfig = {
  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
  },
  redis: {
    url: process.env.REDIS_URL,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },
  ton: {
    apiKey: process.env.TON_API_KEY,
    rpcEndpoint: process.env.TON_RPC_ENDPOINT,
  },
  telegram: {
    clientToken: process.env.TELEGRAM_BOT_TOKEN_CLIENT,
    workerToken: process.env.TELEGRAM_BOT_TOKEN_WORKER,
  },
};
```

## 🚢 Deployment

### Docker Configuration
```dockerfile
# services/labeling-backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN pnpm ci --only=production

COPY . .
RUN pnpm build

EXPOSE 3101

CMD ["pnpm", "start"]
```

### Kubernetes Deployment
```yaml
# k8s/labeling-backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: labeling-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: labeling-backend
  template:
    metadata:
      labels:
        app: labeling-backend
    spec:
      containers:
      - name: labeling-backend
        image: labelmint/labeling-backend:latest
        ports:
        - containerPort: 3101
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: labelmint-secrets
              key: database-url
```

### CI/CD Pipeline
```yaml
# .github/workflows/services.yml
name: Build and Deploy Services
on:
  push:
    paths: ['services/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm run test:services
      - run: pnpm run build:services

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          docker build -t labelmint/service:${{ github.sha }} .
          docker push labelmint/service:${{ github.sha }}
```

## 📊 Performance Optimization

### Database Optimization
- **Connection Pooling** with PgBouncer
- **Query Optimization** with proper indexing
- **Read Replicas** for scaling reads
- **Database Partitioning** for large tables
- **Caching Layer** with Redis

### API Performance
- **Response Caching** with Redis
- **Request Compression** with Gzip
- **Rate Limiting** to prevent abuse
- **Async Processing** for heavy operations
- **Load Balancing** across instances

### Memory Management
- **Process Monitoring** with PM2
- **Memory Leaks Detection** with clinic.js
- **Garbage Collection Optimization**
- **Stream Processing** for large data
- **Worker Threads** for CPU-intensive tasks

## 🧪 Testing Strategy

### Unit Testing
```typescript
// Example test for labeling service
import { TaskService } from '../services/TaskService';
import { createTestTask } from '../factories/TaskFactory';

describe('TaskService', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
  });

  it('should create a new task', async () => {
    const taskData = createTestTask();
    const task = await taskService.createTask(taskData);

    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');
  });
});
```

### Integration Testing
```typescript
// Example integration test
import request from 'supertest';
import { app } from '../app';

describe('POST /api/tasks', () => {
  it('should create a task and return 201', async () => {
    const taskData = {
      title: 'Test Task',
      type: 'classification',
      data: { image: 'test.jpg' },
    };

    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send(taskData)
      .expect(201);

    expect(response.body.id).toBeDefined();
  });
});
```

### Load Testing
```javascript
// Artillery load test configuration
module.exports = {
  config: {
    target: 'http://localhost:3101',
    phases: [
      { duration: 60, arrivalRate: 10 },
      { duration: 120, arrivalRate: 50 },
      { duration: 60, arrivalRate: 100 },
    ],
  },
  scenarios: [
    {
      name: 'Create and complete tasks',
      weight: 70,
      flow: [
        { post: { url: '/api/tasks' } },
        { think: 1 },
        { post: { url: '/api/tasks/{{ id }}/submit' } },
      ],
    },
  ],
};
```

## 🔍 Debugging & Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check port conflicts
lsof -i :3101

# Check environment variables
printenv | grep DATABASE_URL

# Check logs
docker-compose logs labeling-backend
```

#### Database Connection Issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
SELECT * FROM pg_stat_activity WHERE datname = 'labelmint';
```

#### Performance Issues
```bash
# Check memory usage
docker stats

# Profile Node.js application
node --inspect app.js

# Analyze heap dump
node --inspect app.js --heap-prof
```

### Debugging Tools
- **VS Code Debugger** for local development
- **Chrome DevTools** for Node.js debugging
- **Postman** for API testing
- **Docker Logs** for container debugging
- **Grafana Dashboards** for performance monitoring

## 📚 Documentation

### API Documentation
- **OpenAPI 3.0** specifications
- **Swagger UI** for interactive documentation
- **Postman Collections** for testing
- **Code Examples** in multiple languages

### Service Documentation
- **README.md** in each service directory
- **Architecture Decision Records (ADRs)**
- **Database Schema Documentation**
- **Deployment Guides**

### Developer Documentation
- **Getting Started Guide**
- **Development Workflow**
- **Testing Guidelines**
- **Contribution Guide**

## 🤝 Contributing

### Development Guidelines
1. **Follow TypeScript** best practices
2. **Write tests** for all new features
3. **Document APIs** with OpenAPI specs
4. **Use semantic versioning** for releases
5. **Follow git commit** message conventions

### Code Review Process
1. **Create Pull Request** from feature branch
2. **Automated Tests** must pass
3. **Code Coverage** must be maintained
4. **Security Review** for sensitive changes
5. **Performance Review** for critical paths
6. **Documentation Review** for API changes

## 📄 License

All services are licensed under the MIT License. See [LICENSE](../../LICENSE) file for details.

---

**🚀 Built with ❤️ by the LabelMint Team**

For scalable, secure, and high-performance microservices architecture.