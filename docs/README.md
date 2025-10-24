# 📚 LabelMint Documentation Hub

Comprehensive documentation for the LabelMint data labeling platform - a modern, scalable solution built for enterprise-grade data annotation with Telegram integration and TON blockchain payments.

## 🎯 Quick Navigation

### 🚀 Getting Started
- [**Main README**](../README.md) - Platform overview and quick start
- [**Setup Guide**](./SETUP.md) - Complete installation and configuration
- [**Development Guide**](./DEVELOPMENT.md) - Development workflow and standards
- [**Architecture Overview**](./ARCHITECTURE.md) - System design and patterns

### 🏗️ Platform Components
- [**Applications**](../apps/README.md) - Web, Admin, and Telegram Mini Apps
- [**Services**](../services/README.md) - Backend microservices architecture
- [**Infrastructure**](../infrastructure/README.md) - Cloud and container infrastructure
- [**Configuration**](../config/README.md) - Centralized configuration management

### 🔧 Technical Documentation
- [**API Documentation**](./api/README.md) - REST API and WebSocket endpoints
- [**Security Guide**](./SECURITY.md) - Security policies and best practices
- [**Configuration Guide**](./CONFIGURATION.md) - Environment and service configuration
- [**Deployment Guide**](./DEPLOYMENT.md) - Production deployment procedures

### 📋 Operations & Runbooks
- [**Operations Runbooks**](./runbooks/README.md) - Operational procedures and troubleshooting
- [**Incident Response**](./runbooks/incident-response.md) - Incident management procedures
- [**Scaling Procedures**](./runbooks/scaling-procedures.md) - System scaling guidelines
- [**Database Maintenance**](./runbooks/database-maintenance.md) - Database operations

## 📖 Documentation Structure

```
docs/
├── README.md                    # This file - Documentation hub
├── ARCHITECTURE.md              # System architecture and design
├── SETUP.md                     # Installation and setup guide
├── DEVELOPMENT.md               # Development workflow and standards
├── CONFIGURATION.md             # Configuration management
├── DEPLOYMENT.md                # Production deployment guide
├── SECURITY.md                  # Security policies and procedures
├── API/                         # API Documentation
│   ├── README.md               # API overview and authentication
│   ├── tasks.md                # Tasks API endpoints
│   ├── rate-limiting.md        # API rate limiting policies
│   └── versioning-strategy.md  # API versioning approach
├── DEPLOYMENT/                  # Deployment Documentation
│   ├── README.md               # Deployment overview
│   └── production.md           # Production deployment details
├── RUNBOOKS/                    # Operational Procedures
│   ├── README.md               # Operations overview
│   ├── incident-response.md    # Incident management
│   ├── database-maintenance.md # Database operations
│   ├── scaling-procedures.md   # System scaling
│   ├── backup-restoration.md   # Backup and recovery
│   └── security-incidents.md   # Security incident response
└── ARCHITECTURE/                # Technical Architecture
    └── overview.md             # Architecture deep dive
```

## 🎯 Platform Overview

LabelMint is a comprehensive data labeling platform that combines:

### 🤖 Telegram Integration
- **Seamless User Experience** through familiar Telegram interface
- **Mobile-First Design** optimized for smartphone usage
- **Real-time Notifications** for task updates and payments
- **Bot Management** for client and worker interactions

### 💰 Blockchain Payments
- **TON Network Integration** for fast, low-cost transactions
- **USDT Stablecoin** payments for price stability
- **Smart Contract Escrow** for secure payment handling
- **Automated Withdrawals** with transparent tracking

### 🏗️ Scalable Architecture
- **Microservices Design** for independent scaling
- **Multi-tenant Support** for enterprise clients
- **Real-time Analytics** for performance monitoring
- **API-First Approach** for easy integration

### 🔒 Enterprise Security
- **End-to-end Encryption** for data protection
- **Role-Based Access Control** (RBAC)
- **Audit Logging** for compliance
- **SOC 2 Type II** certified infrastructure

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** 18+ and pnpm package manager
- **Docker** and Docker Compose
- **Telegram Bot Tokens** (from @BotFather)
- **TON Wallet** for payment processing
- **Supabase CLI** (for database management)

### 5-Minute Setup

1. **Clone Repository**
   ```bash
   git clone https://github.com/your-org/labelmint.git
   cd labelmint
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Setup Environment**
   ```bash
   cp .env.example .env.local
   # Configure your environment variables
   ```

4. **Start Services**
   ```bash
   pnpm run dev
   ```

5. **Access Applications**
   - **Web App**: http://localhost:3000
   - **Admin Panel**: http://localhost:3001
   - **API Documentation**: http://localhost:3104/docs

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Admin Panel   │    │  Telegram Mini  │
│                 │    │                 │    │      App        │
│ • Progressive   │    │ • Enterprise    │    │ • Mobile-first  │
│   Web App       │    │   Dashboard     │    │ • Bot Integration│
│ • Desktop &     │    │ • Analytics     │    │ • Task Labels   │
│   Mobile        │    │ • User Mgmt     │    │ • Earnings      │
│ • PWA Features  │    │ • Financials    │    │ • Gamification  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     API Gateway          │
                    │  (Authentication &       │
                    │   Request Routing)       │
                    └─────────────┬─────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                            │                            │
┌───▼────┐    ┌───────────┐    ┌────▼────┐    ┌─────────────┐
│ Bots   │    │ Labeling  │    │ Payment  │    │ Analytics   │
│ Service│    │ Backend   │    │ Backend   │    │ Engine      │
└────────┘    └───────────┘    └───────────┘    └─────────────┘
    │                 │                 │                 │
    ▼                 ▼                 ▼                 ▼
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Redis   │    │ PostgreSQL  │    │ TON Network │    │ ClickHouse  │
│ (Queue) │    │ (Database)  │    │ (Blockchain)│    │ (Analytics) │
└─────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-------------|---------|
| **Frontend** | Next.js 15, React 19, TypeScript | Web applications |
| **Mobile** | Telegram Web App SDK, React 19 | Mobile experience |
| **Backend** | Node.js, Express, TypeScript | API services |
| **Database** | PostgreSQL 15, Redis 7 | Data storage & caching |
| **Blockchain** | TON SDK, Smart Contracts | Payment processing |
| **Infrastructure** | Docker, Kubernetes, AWS | Deployment & scaling |
| **Monitoring** | Prometheus, Grafana, Sentry | Observability |

## 🔧 Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Start development environment
pnpm run dev

# Run tests
pnpm run test

# Type checking
pnpm run type-check

# Linting and formatting
pnpm run lint
pnpm run format
```

### Service Management

```bash
# Start specific services
pnpm run dev:web              # Web application
pnpm run dev:admin           # Admin dashboard
pnpm run dev:telegram        # Telegram mini app
pnpm run dev:api-gateway     # API Gateway
pnpm run dev:labeling        # Labeling backend
pnpm run dev:payment         # Payment backend
pnpm run dev:bots            # Telegram bots
```

### Database Operations

```bash
# Database migrations
pnpm run db:migrate

# Seed development data
pnpm run db:seed

# Reset database
pnpm run db:reset

# Generate Prisma client
pnpm run db:generate
```

## 🚀 Deployment

### Environment Strategy

| Environment | Purpose | URL |
|-------------|---------|-----|
| **Development** | Local development & testing | `localhost` |
| **Staging** | Pre-production validation | `staging.labelmint.com` |
| **Production** | Live production environment | `labelmint.com` |

### Deployment Methods

#### Docker Compose (Recommended for Development)
```bash
# Development deployment
docker-compose -f config/docker/docker-compose.yml \
               -f config/docker/docker-compose.dev.yml up -d

# Production deployment
docker-compose -f config/docker/docker-compose.yml \
               -f config/docker/docker-compose.prod.yml up -d
```

#### Kubernetes (Production)
```bash
# Apply all manifests
kubectl apply -f infrastructure/k8s/

# Check deployment status
kubectl get pods -n labelmint
kubectl get services -n labelmint
```

#### Terraform (Cloud Infrastructure)
```bash
cd infrastructure/terraform

# Initialize and plan
terraform init
terraform plan -var-file=environments/production.tfvars

# Apply infrastructure
terraform apply -var-file=environments/production.tfvars
```

## 📊 API Documentation

### Authentication

All API endpoints use JWT-based authentication:

```http
Authorization: Bearer <jwt_token>
```

### Core Endpoints

| Service | Base Path | Description |
|---------|-----------|-------------|
| **API Gateway** | `/api/v1` | Central API routing |
| **Tasks** | `/api/v1/tasks` | Task management |
| **Projects** | `/api/v1/projects` | Project operations |
| **Payments** | `/api/v1/payments` | Payment processing |
| **Users** | `/api/v1/users` | User management |
| **Analytics** | `/api/v1/analytics` | Data analytics |

### WebSocket Events

Real-time communication via WebSocket:

```javascript
// Authentication
socket.emit('authenticate', { token: 'jwt_token' });

// Task notifications
socket.on('task_assigned', (task) => {
  // Handle new task assignment
});

// Payment notifications
socket.on('payment_received', (payment) => {
  // Handle payment confirmation
});
```

## 🔒 Security

### Security Features

- **End-to-end Encryption** for all data
- **Multi-factor Authentication** (MFA)
- **Role-based Access Control** (RBAC)
- **Security Audit Logs**
- **Vulnerability Scanning**
- **Compliance Certifications** (SOC 2, GDPR, PCI DSS)

### Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for sensitive configuration
3. **Enable MFA** for all admin accounts
4. **Regular security audits** and penetration testing
5. **Keep dependencies updated** and scan for vulnerabilities

## 📈 Monitoring & Observability

### Monitoring Stack

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation and querying
- **Jaeger**: Distributed tracing
- **Sentry**: Error tracking and performance monitoring

### Key Metrics

- **Application Performance**: Response times, error rates, throughput
- **Infrastructure**: CPU, memory, disk, network utilization
- **Business Metrics**: User activity, task completion rates, revenue
- **Security**: Authentication events, API access patterns

## 🧪 Testing

### Testing Strategy

- **Unit Tests**: Component-level testing with Jest
- **Integration Tests**: API and service integration testing
- **E2E Tests**: End-to-end user journey testing with Playwright
- **Performance Tests**: Load testing with k6
- **Security Tests**: Vulnerability scanning and penetration testing

### Test Coverage

- **Frontend**: React components, hooks, utilities
- **Backend**: API endpoints, services, database operations
- **Infrastructure**: Deployment scripts, configuration validation

## 🤝 Contributing

### Development Guidelines

1. **Follow TypeScript** best practices and strict mode
2. **Write tests** for all new features and bug fixes
3. **Document APIs** with OpenAPI specifications
4. **Use semantic versioning** for releases
5. **Follow git commit** message conventions

### Pull Request Process

1. **Create feature branch** from `develop`
2. **Make changes** with comprehensive tests
3. **Update documentation** as needed
4. **Submit pull request** with detailed description
5. **Code review** by maintainers
6. **Automated tests** must pass
7. **Merge** after approval

### Code Standards

- **ESLint** and **Prettier** for code formatting
- **Husky** for git hooks and pre-commit checks
- **Conventional Commits** for commit messages
- **TypeScript** strict mode for type safety

## 📞 Support & Community

### Getting Help

- **📚 Documentation**: [docs/](./) directory
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/your-org/labelmint/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/your-org/labelmint/discussions)
- **📧 Email**: support@labelmint.com
- **🔔 Discord**: [Join our Discord](https://discord.gg/labelmint)

### Community Resources

- **Blog**: [blog.labelmint.com](https://blog.labelmint.com)
- **Tutorials**: [tutorials.labelmint.com](https://tutorials.labelmint.com)
- **YouTube Channel**: [youtube.com/@labelmint](https://youtube.com/@labelmint)
- **Twitter**: [@labelmint](https://twitter.com/labelmint)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🗺️ Roadmap

### Q1 2024
- [x] **Microservices Architecture** complete
- [x] **PWA Features** implementation
- [x] **Advanced Analytics** dashboard
- [ ] **AI-Powered Task Assistance** beta

### Q2 2024
- [ ] **Enterprise SSO Integration**
- [ ] **Advanced Consensus Algorithms**
- [ ] **Mobile Apps** (iOS/Android)
- [ ] **White-label Solutions**

### Q3 2024
- [ ] **Computer Vision Tasks**
- [ ] **Audio Transcription**
- [ ] **Advanced Quality Control**
- [ ] **Multi-language Support**

### Q4 2024
- [ ] **Blockchain Governance**
- [ ] **Decentralized Storage**
- [ ] **Advanced Analytics** v2
- [ ] **Global Expansion**

---

**🚀 Built with ❤️ by the LabelMint Team**

For scalable, secure, and exceptional data labeling solutions.

### Quick Links

- **🏠 [Home](../README.md)** | **📖 [Setup](./SETUP.md)** | **🏗️ [Architecture](./ARCHITECTURE.md)** | **🔧 [API](./api/README.md)** | **🚀 [Deploy](./DEPLOYMENT.md)** | **🔒 [Security](./SECURITY.md)** | **📋 [Runbooks](./runbooks/README.md)** | **🤝 [Contributing](./DEVELOPMENT.md)**