# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development Commands
- `pnpm run dev` - Start all development services in parallel
- `pnpm run build` - Build all packages and applications
- `pnpm run test` - Run all tests using Vitest
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run test:coverage` - Run tests with coverage report
- `pnpm run lint` - Run ESLint on all files
- `pnpm run lint:fix` - Run ESLint with auto-fix
- `pnpm run type-check` - Run TypeScript type checking across all packages
- `pnpm run format` - Format code with Prettier
- `pnpm run format:check` - Check code formatting

### Advanced Testing Commands
- `pnpm run test:runner` - Use unified test runner with advanced options
- `pnpm run test:all` - Run complete test suite (unit + integration + e2e + contracts)
- `pnpm run test:all:coverage` - Run all tests with comprehensive coverage
- `pnpm run test:unit:ci` - Run unit tests for CI with JSON reporter and bail on 5 failures
- `pnpm run test:integration:ci` - Run integration tests for CI with bail on 3 failures
- `pnpm run test:e2e:ci` - Run E2E tests for CI with bail on first failure
- `pnpm run test:smoke` - Run critical smoke tests
- `pnpm run test:critical` - Run all critical-path tests across all test types

### Validation and Dependency Commands
- `pnpm run validate-configs` - Validate configuration files
- `pnpm run check-deps` - Check for dependency issues
- `pnpm run fix-deps` - Automatically fix dependency problems

### Specialized Testing Commands
- `pnpm run test:unit` - Run unit tests only
- `pnpm run test:integration` - Run integration tests
- `pnpm run test:e2e` - Run end-to-end tests with Playwright
- `pnpm run test:performance` - Run performance tests
- `pnpm run test:frontend` - Run frontend-specific tests
- `pnpm run test:backend` - Run backend-specific tests
- `pnpm run test:bot` - Run Telegram bot tests
- `pnpm run test:contracts` - Run smart contract tests

### Database Commands
- `pnpm run db:generate` - Generate TypeScript types from Supabase
- `pnpm run db:migrate` - Run database migrations
- `pnpm run db:push` - Push database changes to Supabase
- `pnpm run db:seed` - Seed database with test data
- `pnpm run db:start` - Start local Supabase instance
- `pnpm run db:stop` - Stop local Supabase instance
- `pnpm run db:reset` - Reset database and reseed

### Supabase Remote Management
- `pnpm run supabase:init` - Initialize remote Supabase management
- `pnpm run supabase:start` - Start remote Supabase services
- `pnpm run supabase:migrate` - Run remote migrations
- `pnpm run supabase:push` - Push changes to remote Supabase
- `pnpm run supabase:types` - Generate types from remote Supabase

### Service-Specific Commands
- `pnpm run services:up` - Start all backend services
- `pnpm run apps:up` - Start all frontend applications
- `pnpm run services:enterprise:up` - Start enterprise services only

### Smart Contract Commands
- `pnpm run contracts:build` - Compile smart contracts
- `pnpm run contracts:deploy:testnet` - Deploy to testnet
- `pnpm run contracts:deploy:mainnet` - Deploy to mainnet
- `pnpm run deploy:contracts` - Deploy contracts using deployment script

### Docker Commands
- `pnpm run docker:build` - Build Docker images
- `pnpm run docker:up` - Start services with Docker Compose
- `pnpm run docker:down` - Stop Docker services

### Infrastructure and Deployment Scripts
- `node scripts/deploy-smart-contracts.ts` - Deploy smart contracts to blockchain
- `node scripts/test-runner.ts` - Advanced test runner with configuration options
- `bash scripts/verify-infrastructure.sh` - Verify infrastructure setup
- `bash scripts/health-check.sh` - Run system health checks
- `bash scripts/smoke-tests.sh` - Run smoke tests after deployment
- `bash scripts/zero-downtime-deploy.sh` - Deploy without downtime
- `bash scripts/production-backup.sh` - Backup production data
- `bash scripts/setup-monitoring.sh` - Setup monitoring infrastructure
- `bash scripts/integration-tests.sh` - Run integration test suite

## Architecture Overview

LabelMint is a comprehensive data labeling platform built with a microservices architecture. The system integrates Telegram for user interaction and TON blockchain for payment processing.

### Core Components

**Frontend Applications (apps/)**
- `web/` - Main Next.js web application (React 19, TypeScript, Tailwind CSS)
- `admin/` - Admin dashboard for platform management
- `telegram-mini-app/` - Telegram Mini App for mobile task completion

**Backend Services (services/)**
- `labeling-backend/` - Core labeling and task management service
- `payment-backend/` - TON/USDT payment processing with smart contracts
- `api-gateway/` - API Gateway for routing and authentication
- `bots/` - Telegram bot service for user interaction
- `enterprise-api/` - Enterprise features and API endpoints

**Shared Packages (packages/)**
- `shared/` - Shared utilities, types, and business logic
- `ui/` - Reusable React components and design system

### Technology Stack

**Frontend**: Next.js 15, React 19, TypeScript 5.7+, Tailwind CSS, Zustand
**Backend**: Node.js 20+, Express.js, TypeScript, PostgreSQL, Redis
**Blockchain**: TON SDK, Smart Contracts (USDT payments)
**Infrastructure**: Docker, Kubernetes, AWS
**Testing**: Vitest, Playwright, Jest

### Key Architectural Patterns

- **Microservices**: Independent services with separate databases
- **Event-Driven**: Asynchronous communication via events and message queues
- **API Gateway**: Single entry point for routing, auth, and rate limiting
- **Database per Service**: Each service manages its own PostgreSQL database
- **Caching**: Redis for session management and caching
- **Smart Contracts**: Escrow-based payment system on TON blockchain

## Development Workflow

### Environment Setup
1. Use Node.js 20+ and pnpm 9.15.1+
2. Copy `.env.example` to `.env.local` and configure environment variables
3. Run `pnpm install` to install dependencies
4. Start development with `pnpm run dev`

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature branches
- `hotfix/*` - Critical bug fixes

### Commit Message Format
Use conventional commits: `<type>(<scope>): <description>`
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `test:` - Test additions/updates
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks

### Testing Strategy
Follow the test pyramid:
- **Unit Tests (70%)**: Test individual functions and components
- **Integration Tests (20%)**: Test API endpoints and database operations
- **E2E Tests (10%)**: Test complete user journeys

## Important File Locations

### Configuration Files
- `package.json` - Root package configuration with workspace setup
- `pnpm-workspace.yaml` - PNPM workspace configuration
- `eslint.config.js` - ESLint configuration
- `prettier.config.js` - Prettier configuration
- `tact.config.json` - TON smart contract configuration
- `vitest.config.ts` - Vitest configuration for unit tests
- `vitest.integration.config.ts` - Integration test configuration
- `vitest.e2e.config.ts` - E2E test configuration
- `vitest.performance.config.ts` - Performance test configuration
- `vitest.frontend.config.ts` - Frontend-specific test configuration
- `vitest.backend.config.ts` - Backend-specific test configuration
- `vitest.bot.config.ts` - Telegram bot test configuration

### Key Service Files
- `services/labeling-backend/src/` - Core labeling service implementation
- `services/payment-backend/src/services/payment/` - Payment processing logic
- `services/api-gateway/src/` - API Gateway implementation
- `packages/shared/src/types/` - Shared TypeScript types
- `packages/ui/src/` - Reusable UI components

### Test Files
- Tests are co-located with source files using `*.test.ts` pattern
- Global test configuration in root `vitest*.config.ts` files
- E2E tests in separate test directories

## Database Schema

### Core Tables
- `users` - User profiles and authentication
- `projects` - Labeling projects management
- `tasks` - Individual labeling tasks
- `task_submissions` - Worker task submissions
- `wallets` - TON wallet information
- `transactions` - Payment transactions
- `consensus_reviews` - Quality consensus system

### Database Management
- Uses PostgreSQL as primary database
- Redis for caching and session management
- Prisma ORM for database operations
- Database migrations via Supabase CLI

## Payment System

### TON Blockchain Integration
- USDT payments for task rewards
- Smart contract escrow system
- Automatic dispute resolution via consensus
- Multi-wallet support for users

### Payment Flow
1. Project owner funds task escrow
2. Worker completes task
3. Quality consensus review
4. Payment released to worker's wallet

## Security Considerations

- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- End-to-end encryption for sensitive data
- Rate limiting and DDoS protection
- Input validation and sanitization
- Audit logging for compliance

## Performance Optimization

### Caching Strategy
- Multi-level caching (memory, Redis, CDN)
- Database query optimization
- Lazy loading for large datasets
- Image and asset optimization

### Monitoring
- Application performance monitoring
- Error tracking and alerting
- Database performance metrics
- Real-time analytics dashboard

## Common Development Tasks

### Adding New Feature
1. Create feature branch from develop
2. Implement functionality with TDD approach
3. Add comprehensive tests
4. Run `pnpm run lint` and `pnpm run type-check`
5. Submit PR with detailed description

### Database Changes
1. Create migration using Supabase CLI
2. Update TypeScript types with `pnpm run db:generate`
3. Test migration on development database
4. Update affected service code

### Adding New API Endpoint
1. Implement in appropriate service
2. Add authentication/authorization as needed
3. Add input validation using Zod
4. Write integration tests
5. Update API documentation

## Troubleshooting

### Common Issues
- **Port conflicts**: Check `.env.local` for port assignments
- **Database connection**: Verify PostgreSQL is running and connection string is correct
- **TypeScript errors**: Run `pnpm run type-check` to identify issues
- **Test failures**: Use `pnpm run test:watch` for interactive debugging

### Debug Commands
- `pnpm run dev` with DEBUG=* for verbose logging
- Database queries can be logged via Prisma configuration
- API requests can be debugged using request middleware

## Enterprise Features

The platform includes enterprise-specific functionality:
- Multi-tenant support
- Advanced analytics and reporting
- White-label customization
- Enterprise-grade security and compliance
- Advanced user management and permissions

These features are primarily located in the `enterprise-api` service and related packages.

## CI/CD Pipeline

The project uses a sophisticated GitHub Actions CI/CD pipeline (`.github/workflows/labelmint-ci-cd.yml`) with:

### Pipeline Stages
1. **Code Quality & Security** - ESLint, Prettier, TypeScript, security audit
2. **Comprehensive Testing** - Unit, integration, E2E, and smart contract tests in parallel
3. **Advanced Security Scanning** - CodeQL, Semgrep, Snyk security analysis
4. **Container Building** - Multi-platform Docker builds with security scanning
5. **Performance Testing** - Lighthouse CI and k6 load testing (staging only)
6. **Automated Deployment** - Terraform-based deployments to staging/production
7. **Health Checks & Rollback** - Automatic rollback on deployment failure

### Key Features
- **Parallel Execution**: Tests run in parallel across different environments
- **Advanced Caching**: Multi-layer caching for dependencies and Docker layers
- **Security Focus**: Multiple security scanning tools and vulnerability assessments
- **Zero-Downtime Deployment**: Terraform-based infrastructure updates
- **Automatic Rollback**: Failed production deployments automatically rollback
- **Performance Monitoring**: Lighthouse and load testing integration

### Environment Strategy
- **develop** → Staging environment (`staging.labelmint.it`)
- **main** → Production environment (`labelmint.it`)
- **Manual triggers** with workflow dispatch for custom deployments

## Infrastructure Management

### Terraform Configuration
Infrastructure is managed through Terraform with separate environments:
- `infrastructure/terraform/main.tf` - Core infrastructure configuration
- `infrastructure/terraform/environments/production.tfvars` - Production variables
- `infrastructure/terraform/environments/staging.tfvars` - Staging variables

### Kubernetes Deployment
Kubernetes configurations using Kustomize:
- `infrastructure/k8s/base/` - Base Kubernetes manifests
- `infrastructure/k8s/overlays/production/` - Production-specific configurations
- `infrastructure/k8s/overlays/staging/` - Staging-specific configurations

### Components Managed by Infrastructure
- **AWS Resources**: RDS PostgreSQL, ElastiCache Redis, S3 storage, Application Load Balancer
- **Kubernetes**: EKS cluster with auto-scaling, pod security policies, resource quotas
- **Monitoring**: Prometheus, Grafana, Loki, Tempo, AlertManager
- **Security**: WAF rules, network policies, security groups, secrets management
- **CDN**: Cloudflare for static assets and DDoS protection

### Docker Configuration
Multi-stage Docker builds for different components:
- `infrastructure/docker/labelmint-frontend.dockerfile` - Frontend application
- `infrastructure/docker/labelmint-backend.dockerfile` - Backend services
- Multi-architecture support (linux/amd64, linux/arm64)

## Monitoring and Observability

### Monitoring Stack
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation and analysis
- **Tempo**: Distributed tracing
- **AlertManager**: Alert routing and notification

### Key Dashboards
- `infrastructure/monitoring/grafana/dashboards/labelmint-overview.json` - System overview
- `infrastructure/monitoring/grafana/dashboards/backend-overview.json` - Backend metrics
- `infrastructure/monitoring/grafana/dashboards/security-overview.json` - Security monitoring

### Alerting Rules
- `infrastructure/monitoring/prometheus.yml/rules/labelmint-alerts.yml` - Core application alerts
- `infrastructure/monitoring/prometheus/alerts/backend-alerts.yml` - Backend-specific alerts
- `infrastructure/security-monitoring/` - Security-focused monitoring

### Performance Monitoring
- **Application Performance**: Response times, error rates, throughput
- **Infrastructure Metrics**: CPU, memory, disk, network utilization
- **Business Metrics**: Task completion rates, payment processing, user activity
- **Security Monitoring**: Failed logins, suspicious activities, API abuse

## Security Infrastructure

### Security Layers
- **AWS WAF**: Web Application Firewall with custom rules
- **Network Security**: VPC with security groups and network ACLs
- **Container Security**: Pod security policies and runtime security
- **Secrets Management**: AWS Secrets Manager for sensitive data
- **Security Scanning**: CodeQL, Semgrep, Snyk integration in CI/CD

### Security Monitoring
- **Security Events**: Real-time security event monitoring
- **Vulnerability Scanning**: Regular vulnerability assessments
- **Compliance Monitoring**: SOC 2 and compliance checks
- **Incident Response**: Automated security incident handling

### Security Configuration Files
- `infrastructure/security/vault-config.yaml` - HashiCorp Vault configuration
- `infrastructure/security/pod-security-policy.yaml` - Kubernetes security policies
- `infrastructure/security/network-policy.yaml` - Network security rules

## TON Blockchain Integration

### Smart Contract Development
- **tact.config.json** - TON smart contract development configuration
- **contracts/** - Smart contract source code and deployment scripts
- **USDT Integration**: USDT stablecoin payments for task rewards

### Payment Processing
- **Escrow System**: Smart contract-based escrow for task payments
- **Multi-wallet Support**: Users can connect multiple TON wallets
- **Transaction Monitoring**: Real-time blockchain transaction monitoring
- **Automated Payouts**: Automated payment distribution upon task completion

### Blockchain Infrastructure
- **Testnet and Mainnet**: Separate deployments for testing and production
- **Node Management**: TON node infrastructure for reliable connectivity
- **Gas Optimization**: Optimized transactions for cost efficiency