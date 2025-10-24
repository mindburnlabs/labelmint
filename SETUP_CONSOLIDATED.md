# 🛠️ SETUP - Installation & Development Environment

Complete guide for setting up LabelMint development environment, from installation to running the full application stack.

## 📋 Table of Contents

- [🎯 Prerequisites](#-prerequisites)
- [⚡ Quick Start](#-quick-start)
- [🔧 Detailed Setup](#-detailed-setup)
- [🌐 Environment Configuration](#-environment-configuration)
- [🚀 Running Services](#-running-services)
- [🗄️ Database Setup](#️-database-setup)
- [🧪 Testing Setup](#-testing-setup)
- [🔍 Troubleshooting](#-troubleshooting)
- [📖 Development Workflow](#-development-workflow)

---

## 🎯 Prerequisites

### Required Software

- **Node.js** 18.0+ with npm/pnpm
- **Docker** 20.0+ and Docker Compose
- **Git** 2.30+
- **Make** (for convenience scripts)

### Development Tools (Recommended)

- **VS Code** with recommended extensions
- **PostgreSQL Client** (DBeaver, pgAdmin, or similar)
- **Redis Client** (RedisInsight)
- **API Client** (Postman, Insomnia)

### External Services

- **GitHub Account** with repository access
- **Supabase Project** (database and auth)
- **Telegram Bot Token** from @BotFather
- **TON Wallet** for payment processing
- **AWS Account** (for cloud resources)

---

## ⚡ Quick Start (5 Minutes)

Get LabelMint running locally in minutes:

### 1. Clone Repository

```bash
git clone https://github.com/your-org/labelmint.git
cd labelmint
```

### 2. Install Dependencies

```bash
# Install pnpm if not available
npm install -g pnpm

# Install all dependencies
pnpm install
```

### 3. Setup Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your configuration
nano .env.local
```

### 4. Start Infrastructure

```bash
# Start databases and services
make infra-up

# Or with Docker Compose
docker-compose up -d postgres redis
```

### 5. Initialize Database

```bash
# Run database migrations
make db-migrate

# Seed development data
make db-seed
```

### 6. Start Applications

```bash
# Start all applications
pnpm run dev

# Or start individual services
pnpm run dev:web
pnpm run dev:admin
pnpm run dev:api
```

### 7. Access Applications

- **Web App**: http://localhost:3000
- **Admin Panel**: http://localhost:3001
- **API Gateway**: http://localhost:3002
- **API Docs**: http://localhost:3002/docs

---

## 🔧 Detailed Setup

### 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Admin Panel   │    │  Telegram Bot   │
│   (Next.js)     │    │   (Next.js)     │    │   (Node.js)     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
          ┌──────────────────────┴──────────────────────┐
          │              API Gateway                    │
          │           (Express, Node.js)                │
          └──────────────────────┬──────────────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                            │                            │
┌───▼───┐    ┌───────────┐    ┌────▼────┐    ┌─────────────┐
│ Tasks │    │ Payments  │    │ Users   │    │ Consensus   │
│Service│    │ Service   │    │ Service │    │ Engine      │
└───────┘    └───────────┘    └─────────┘    └─────────────┘
    │            │            │            │
    └────────────┼────────────┼────────────┘
                 │            │
        ┌────────▼────┐ ┌─────▼────┐
        │ PostgreSQL  │ │   Redis  │
        │   Database  │ │   Cache  │
        └─────────────┘ └──────────┘
```

### 📁 Project Structure

```
labelmint/
├── apps/                        # Frontend Applications
│   ├── web/                    # Main web application
│   │   ├── src/
│   │   │   ├── app/           # Next.js App Router
│   │   │   ├── components/    # React components
│   │   │   ├── lib/          # Utilities and helpers
│   │   │   └── styles/       # CSS and Tailwind
│   │   ├── public/           # Static assets
│   │   └── package.json
│   ├── admin/                 # Admin dashboard
│   └── telegram-mini-app/     # Telegram Mini App
├── services/                   # Backend Services
│   ├── api-gateway/           # API Gateway
│   ├── tasks/                 # Task management
│   ├── payments/              # Payment processing
│   ├── users/                 # User management
│   └── consensus/             # Consensus engine
├── packages/                   # Shared Packages
│   ├── shared/                # Shared utilities
│   ├── ui/                    # UI components
│   ├── config/                # Configuration
│   └── types/                 # TypeScript definitions
├── infrastructure/             # Infrastructure as Code
│   ├── docker/                # Docker configurations
│   ├── k8s/                   # Kubernetes manifests
│   └── terraform/             # AWS infrastructure
└── docs/                      # Documentation
```

### 🐘 Database Setup

#### PostgreSQL Configuration

```bash
# Start PostgreSQL container
docker run --name labelmint-postgres \
  -e POSTGRES_DB=labelmint \
  -e POSTGRES_USER=labelmint \
  -e POSTGRES_PASSWORD=your-password \
  -p 5432:5432 \
  -d postgres:15

# Connect to database
psql -h localhost -U labelmint -d labelmint
```

#### Database Schema

```sql
-- Core tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE,
    username VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payment and blockchain tables
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    address VARCHAR(255) NOT NULL,
    blockchain VARCHAR(50) DEFAULT 'ton',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES wallets(id),
    amount DECIMAL(20,8) NOT NULL,
    currency VARCHAR(20) DEFAULT 'USDT',
    status VARCHAR(50) DEFAULT 'pending',
    blockchain_tx_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 📱 Telegram Bot Setup

#### Create Telegram Bot

1. **Start Chat with @BotFather**
   ```
   /newbot
   LabelMint
   @LabelMintBot
   ```

2. **Get Bot Token**
   - Copy the bot token provided by BotFather
   - Add to your `.env.local` file

3. **Configure Bot Commands**
   ```
   /setcommands
   start - Start using LabelMint
   help - Get help and information
   balance - Check your balance
   tasks - View available tasks
   profile - View your profile
   ```

#### Telegram Bot Integration

```typescript
// services/telegram-bot/src/bot.ts
import { Bot } from 'grammy';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// Bot commands
bot.command('start', async (ctx) => {
  await ctx.reply('Welcome to LabelMint! 🚀');
});

bot.command('help', async (ctx) => {
  await ctx.reply(`
LabelMint Commands:
/start - Start using the bot
/tasks - View available tasks
/balance - Check your balance
/profile - View your profile
/help - Show this help message
  `);
});

// Start bot
bot.start();
```

---

## 🌐 Environment Configuration

### 📝 Environment Variables

Create `.env.local` in the root directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://labelmint:password@localhost:5432/labelmint
REDIS_URL=redis://localhost:6379

# Application Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook

# TON Blockchain Configuration
TON_CONTRACT_ADDRESS=your-contract-address
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
TON_API_KEY=your-ton-api-key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=labelmint-assets

# Monitoring and Analytics
SENTRY_DSN=your-sentry-dsn
GOOGLE_ANALYTICS_ID=your-ga-id

# Development
NODE_ENV=development
LOG_LEVEL=debug
```

### 🔐 Secrets Management

#### Local Development

```bash
# Generate secure secrets
openssl rand -base64 32

# Store in .env.local (never commit)
NEXTAUTH_SECRET=your-generated-secret
```

#### Production Environment

```bash
# Using AWS Secrets Manager
aws secretsmanager create-secret \
  --name labelmint/production \
  --secret-string file://secrets.json

# Using Kubernetes secrets
kubectl create secret generic labelmint-secrets \
  --from-env-file=.env.production
```

---

## 🚀 Running Services

### 🎯 Development Mode

```bash
# Start all applications
pnpm run dev

# Individual services
pnpm run dev:web          # Web application (localhost:3000)
pnpm run dev:admin        # Admin panel (localhost:3001)
pnpm run dev:api          # API gateway (localhost:3002)
pnpm run dev:telegram     # Telegram bot
pnpm run dev:payments     # Payment service
pnpm run dev:tasks        # Task service
```

### 🏗️ Infrastructure Services

```bash
# Using Make commands
make infra-up             # Start all infrastructure
make infra-down           # Stop all infrastructure
make infra-logs           # View infrastructure logs

# Using Docker Compose
docker-compose up -d       # Start services
docker-compose down        # Stop services
docker-compose logs -f    # View logs
```

### 📊 Monitoring Services

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access monitoring tools
# Grafana: http://localhost:3001
# Prometheus: http://localhost:9090
# Jaeger: http://localhost:16686
```

### 🔧 Service URLs

| Service | Local URL | Description |
|---------|-----------|-------------|
| Web App | http://localhost:3000 | Main user interface |
| Admin Panel | http://localhost:3001 | Administrative interface |
| API Gateway | http://localhost:3002 | REST API endpoints |
| API Docs | http://localhost:3002/docs | Swagger documentation |
| PostgreSQL | localhost:5432 | Primary database |
| Redis | localhost:6379 | Cache and session store |
| Grafana | http://localhost:3001 | Monitoring dashboard |
| Prometheus | http://localhost:9090 | Metrics collection |

---

## 🗄️ Database Setup

### 🚀 Database Initialization

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase project
supabase init

# Start local Supabase
supabase start

# Link to remote project
supabase link --project-ref your-project-ref

# Generate types
supabase gen types typescript --local > types/supabase.ts
```

### 📝 Database Migrations

```bash
# Create new migration
pnpm run db:migration:create add_user_profiles

# Run migrations
pnpm run db:migrate

# Reset database
pnpm run db:reset

# Generate migration from schema changes
pnpm run db:generate
```

### 🌱 Database Seeding

```bash
# Seed development data
pnpm run db:seed

# Seed with specific data
pnpm run db:seed:users
pnpm run db:seed:projects
pnpm run db:seed:tasks

# Reset and reseed
pnpm run db:fresh-seed
```

### 📊 Database Schema Management

```typescript
// services/database/src/migrations/001_initial_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE,
    username VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    requirements JSONB DEFAULT '{}',
    reward_amount DECIMAL(20,8) DEFAULT 0,
    reward_currency VARCHAR(20) DEFAULT 'USDT',
    status VARCHAR(50) DEFAULT 'pending',
    assigned_to UUID REFERENCES users(id),
    completed_by UUID REFERENCES users(id),
    deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
```

---

## 🧪 Testing Setup

### 🎯 Test Configuration

```bash
# Install test dependencies
pnpm add -D jest @types/jest ts-jest
pnpm add -D @playwright/test
pnpm add -D vitest @vitest/ui
```

### 📋 Test Types

```bash
# Unit tests
pnpm run test:unit

# Integration tests
pnpm run test:integration

# E2E tests
pnpm run test:e2e

# All tests
pnpm run test

# Test with coverage
pnpm run test:coverage

# Watch mode
pnpm run test:watch
```

### 🎭 Test Examples

```typescript
// Unit test example
// packages/shared/src/utils/validation.test.ts
import { validateEmail, validateTelegramId } from './validation';

describe('Validation Utils', () => {
  test('validateEmail should validate correct email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
  });

  test('validateTelegramId should validate correct ID', () => {
    expect(validateTelegramId(123456789)).toBe(true);
    expect(validateTelegramId(0)).toBe(false);
  });
});
```

```typescript
// E2E test example
// test/e2e/user-journey.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Journey', () => {
  test('user can complete a labeling task', async ({ page }) => {
    await page.goto('/');

    // Login
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit"]');

    // Navigate to tasks
    await page.click('[data-testid="tasks-nav"]');
    await expect(page).toHaveURL('/tasks');

    // Complete a task
    await page.click('[data-testid="task-card"]:first-child');
    await page.fill('[data-testid="task-input"]', 'Label text');
    await page.click('[data-testid="submit-task"]');

    // Verify completion
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});
```

---

## 🔍 Troubleshooting

### 🚨 Common Issues

#### Port Conflicts

```bash
# Check which ports are in use
lsof -i :3000
lsof -i :5432
lsof -i :6379

# Kill processes using ports
kill -9 <PID>

# Or change ports in .env.local
WEB_PORT=3001
API_PORT=3003
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
docker ps | grep postgres

# View database logs
docker logs labelmint-postgres

# Reset database
docker-compose down postgres
docker volume rm labelmint_postgres_data
docker-compose up -d postgres
```

#### Dependency Issues

```bash
# Clear package manager cache
pnpm store prune

# Reinstall dependencies
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install

# Fix TypeScript issues
pnpm run type-check
pnpm run type-check:fix
```

#### Permission Issues

```bash
# Fix Docker permissions
sudo usermod -aG docker $USER

# Fix file permissions
sudo chown -R $USER:$USER .
chmod -R 755 .
```

### 🛠️ Debugging Tips

#### Application Logs

```bash
# View application logs
pnpm run dev:logs

# View specific service logs
docker logs labelmint-api-gateway
docker logs labelmint-web

# Enable debug logging
DEBUG=* pnpm run dev
```

#### Database Debugging

```bash
# Connect to database
psql -h localhost -U labelmint -d labelmint

# Check table structure
\dt
\d users

# Run queries
SELECT * FROM users LIMIT 10;
SELECT COUNT(*) FROM tasks;
```

#### API Testing

```bash
# Test API endpoints
curl http://localhost:3002/api/health
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

### 📞 Getting Help

- **📚 Documentation**: [docs/](./docs/)
- **🐛 Issue Tracker**: [GitHub Issues](https://github.com/your-org/labelmint/issues)
- **💬 Community**: [Discord Server](https://discord.gg/labelmint)
- **📧 Email**: support@labelmint.com

---

## 📖 Development Workflow

### 🔄 Daily Development

1. **Start Environment**
   ```bash
   make dev-up
   ```

2. **Sync Latest Changes**
   ```bash
   git pull origin main
   pnpm install
   ```

3. **Run Tests**
   ```bash
   pnpm run test
   pnpm run type-check
   ```

4. **Development Work**
   ```bash
   # Make changes
   # Run tests frequently
   pnpm run test:watch
   ```

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

6. **Push and Create PR**
   ```bash
   git push origin feature-branch
   # Create Pull Request on GitHub
   ```

### 🎯 Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Commit with conventional commits
git commit -m "feat: add user authentication"
git commit -m "fix: resolve login validation issue"
git commit -m "docs: update API documentation"

# Push and create PR
git push origin feature/new-feature
```

### 📋 Pre-commit Hooks

```bash
# Install husky
pnpm add -D husky
pnpm run prepare

# Hooks will run automatically:
# - Type checking
# - Linting
# - Formatting
# - Unit tests
```

---

## 🎉 Next Steps

After completing setup:

1. **📖 Read Architecture Documentation**: [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **🔧 Configure Environment**: [CONFIGURATION.md](./CONFIGURATION.md)
3. **🚀 Deploy to Staging**: [DEPLOYMENT.md](./DEPLOYMENT.md)
4. **👨‍💻 Follow Development Guide**: [DEVELOPMENT.md](./DEVELOPMENT.md)
5. **🔐 Review Security Guidelines**: [SECURITY.md](./SECURITY.md)

Welcome to LabelMint development! 🚀

---

<div align="center">

**Need help?** [Contact our team](mailto:support@labelmint.com) or [join our Discord](https://discord.gg/labelmint)

Made with ❤️ by the LabelMint Team

</div>