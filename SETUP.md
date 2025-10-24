# 🚀 LabelMint Setup Guide

Complete guide for installing, configuring, and setting up the LabelMint development environment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Installation](#detailed-installation)
4. [Development Setup](#development-setup)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [Service Configuration](#service-configuration)
8. [Verification](#verification)
9. [Troubleshooting](#troubleshooting)
10. [Next Steps](#next-steps)

## Prerequisites

### Required Software

- **Node.js** 20+ (recommended: use LTS version)
- **pnpm** 9.15.1+ (primary package manager)
- **Docker** 20.10+ and **Docker Compose** 2.0+
- **Git** 2.30+
- **VS Code** (recommended, with extensions below)

### System Requirements

- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 10GB free disk space
- **CPU**: 4 cores minimum (8 cores recommended)

### VS Code Extensions (Recommended)

```bash
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-eslint
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-vscode.vscode-json
```

## Quick Start

Get LabelMint running in under 10 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/mindburn-labs/labelmint.git
cd labelmint

# 2. Install dependencies
pnpm install

# 3. Copy environment template
cp .env.example .env

# 4. Start all services
pnpm run dev
```

That's it! The platform will be available at:
- **Web App**: http://localhost:3002
- **Admin Dashboard**: http://localhost:3000
- **API**: http://localhost:3001
- **Telegram Mini App**: http://localhost:5173

## Detailed Installation

### 1. Repository Setup

```bash
# Clone with SSH (recommended)
git clone git@github.com:mindburn-labs/labelmint.git

# Or clone with HTTPS
git clone https://github.com/mindburn-labs/labelmint.git

# Navigate to project directory
cd labelmint

# Set up git hooks (optional but recommended)
cp scripts/pre-commit .git/hooks/
chmod +x .git/hooks/pre-commit
```

### 2. Package Management

```bash
# Install pnpm if not already installed
npm install -g pnpm@9.15.1

# Verify installation
pnpm --version

# Install all project dependencies
pnpm install

# This will install dependencies for:
# - All apps (web, admin, telegram-mini-app)
# - All services (labeling-backend, payment-backend)
# - All packages (shared, ui, clients)
```

### 3. Environment Setup

```bash
# Create environment files
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp services/labeling-backend/.env.example services/labeling-backend/.env
cp services/payment-backend/.env.example services/payment-backend/.env

# Generate JWT secrets
openssl rand -base64 32  # Use this for JWT_SECRET
```

## Development Setup

### Starting All Services

```bash
# Option 1: Use the convenience script
./scripts/dev/start-all.sh

# Option 2: Use pnpm scripts
pnpm run dev

# Option 3: Start services individually
pnpm run docker:up     # Start infrastructure
pnpm run services:up   # Start backend services
pnpm run apps:up       # Start frontend applications
```

### Individual Service Development

```bash
# Terminal 1 - Labeling Backend (Port 3001)
cd services/labeling-backend
pnpm dev

# Terminal 2 - Payment Backend (Port 3000)
cd services/payment-backend
pnpm dev

# Terminal 3 - Web Application (Port 3002)
cd apps/web
pnpm dev

# Terminal 4 - Admin Dashboard (Port 3000)
cd apps/admin
pnpm dev

# Terminal 5 - Telegram Mini App (Port 5173)
cd apps/telegram-mini-app
pnpm dev
```

### Infrastructure Services

```bash
# Start only infrastructure (PostgreSQL, Redis, MinIO)
pnpm run docker:up

# Start with specific profile
docker-compose -f docker-compose.dev.yml --profile infra up -d

# View infrastructure logs
docker-compose logs -f postgres redis minio
```

## Environment Configuration

### Core Environment Variables

Edit `.env` in the root directory:

```env
# Application
NODE_ENV=development
APP_VERSION=1.0.0
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://labelmint:password@localhost:5432/labelmint_dev
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-32-chars-min
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-32-chars
JWT_REFRESH_EXPIRES_IN=30d

# TON Blockchain
TON_API_KEY=your-toncenter-api-key
TON_MERCHANT_ADDRESS=EQ...your-merchant-address
USDT_MASTER_CONTRACT=EQ...usdt-contract-address

# Telegram Bots
TELEGRAM_BOT_TOKEN_CLIENT=your-client-bot-token
TELEGRAM_BOT_TOKEN_WORKER=your-worker-bot-token

# Storage (MinIO)
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_ENDPOINT=localhost:9000
MINIO_BUCKET=labelmint-dev

# External Services
OPENAI_API_KEY=your-openai-api-key
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
```

### Frontend Environment

Edit `apps/web/.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Telegram Integration
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=LabelMintBot
NEXT_PUBLIC_WEB_APP_URL=http://localhost:3002

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=true
```

### Admin Dashboard Environment

Edit `apps/admin/.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-32-chars

# Admin Features
NEXT_PUBLIC_ENABLE_ADMIN_PANEL=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

## Database Setup

### PostgreSQL Setup

```bash
# Start PostgreSQL (if not already running)
docker-compose up -d postgres

# Run database migrations
pnpm run db:migrate

# Generate Prisma client
pnpm run db:generate

# Seed database with sample data
pnpm run db:seed

# Open Prisma Studio (optional)
pnpm run db:studio
```

### Database Schema

The database includes these main tables:

- **users** - User accounts and profiles
- **projects** - Labeling projects
- **tasks** - Individual labeling tasks
- **task_answers** - Worker submissions
- **transactions** - Payment records
- **wallets** - TON wallet information

### Redis Setup

```bash
# Start Redis (if not already running)
docker-compose up -d redis

# Test Redis connection
redis-cli -u redis://localhost:6379 ping
```

### Supabase Alternative (Optional)

If you prefer using Supabase instead of local PostgreSQL:

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialize Supabase project
pnpm run supabase:init

# Start local Supabase
pnpm run supabase:start

# Generate types
pnpm run db:generate
```

## Service Configuration

### TON Blockchain Setup

1. **Get TON API Key**:
   - Visit [TON Center](https://toncenter.com/)
   - Register for an API key
   - Add to `TON_API_KEY` environment variable

2. **Create Merchant Wallet**:
   - Use TON Wallet or MyTonWallet
   - Create a new wallet
   - Add address to `TON_MERCHANT_ADDRESS`

3. **Test TON Integration**:
   ```bash
   # Test TON connection
   pnpm run test:ton
   ```

### Telegram Bot Setup

1. **Create Bots**:
   - Talk to [@BotFather](https://t.me/botfather) on Telegram
   - Create two bots: one for clients, one for workers
   - Get API tokens for both

2. **Configure Bots**:
   ```env
   TELEGRAM_BOT_TOKEN_CLIENT=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   TELEGRAM_BOT_TOKEN_WORKER=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   ```

3. **Test Bot Connection**:
   ```bash
   # Test client bot
   cd services/bots/client-bot
   pnpm dev

   # Test worker bot
   cd services/bots/worker-bot
   pnpm dev
   ```

### Storage Setup (MinIO)

MinIO is used for local S3-compatible storage:

```bash
# Start MinIO
docker-compose up -d minio

# Access MinIO Console
# URL: http://localhost:9001
# Username: minioadmin
# Password: minioadmin123

# Create buckets
mc alias set local http://localhost:9000 minioadmin minioadmin123
mc mb local/labelmint-dev
mc mb local/labelmint-uploads
```

## Verification

### Health Checks

Verify all services are running correctly:

```bash
# Check API health
curl http://localhost:3001/health

# Check web app
curl http://localhost:3002

# Check admin dashboard
curl http://localhost:3000

# Check Telegram mini app
curl http://localhost:5173
```

### Database Verification

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Redis connection
redis-cli -u $REDIS_URL ping

# Verify data seeding
pnpm run db:verify
```

### Service Dashboard

Access the various services:

| Service | URL | Description |
|---------|-----|-------------|
| Web Application | http://localhost:3002 | Main user interface |
| Admin Dashboard | http://localhost:3000 | Admin panel |
| API Server | http://localhost:3001 | REST API |
| Telegram Mini App | http://localhost:5173 | Mobile interface |
| MinIO Console | http://localhost:9001 | File storage |
| Prisma Studio | http://localhost:5555 | Database viewer |

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Run tests with coverage
pnpm test:coverage
```

## Troubleshooting

### Common Issues

#### Port Conflicts

```bash
# Check what's using ports
lsof -ti:3000,3001,3002,5173,5432,6379,9000,9001

# Kill processes using ports
kill -9 $(lsof -ti:3000)
```

#### Docker Issues

```bash
# Restart Docker services
docker-compose down
docker-compose up -d

# Clear Docker cache
docker system prune -a

# View logs
docker-compose logs -f [service-name]
```

#### Database Connection Issues

```bash
# Reset database
pnpm run db:reset

# Check PostgreSQL status
docker-compose exec postgres pg_isready -U labelmint

# Manual database connection
psql $DATABASE_URL
```

#### Node Module Issues

```bash
# Clean and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install

# Clear cache
pnpm store prune
```

#### Permission Issues

```bash
# Fix Docker permissions
sudo chown -R $USER:$USER .docker

# Fix file permissions
chmod +x scripts/*.sh
```

### Debug Mode

Enable debug logging:

```bash
# Set debug environment
export DEBUG=*
export LOG_LEVEL=debug

# Start with verbose output
pnpm run dev --verbose
```

### Getting Help

1. **Check logs**: All services write detailed logs
2. **Review documentation**: Check specific service documentation
3. **Run diagnostics**: `pnpm run doctor` (if available)
4. **Check GitHub Issues**: Search for similar problems

## Next Steps

### Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** and test:
   ```bash
   # Run tests
   pnpm test

   # Check code quality
   pnpm lint
   pnpm type-check
   ```

3. **Commit changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

### Learning Resources

- [Architecture Overview](./ARCHITECTURE.md)
- [Development Guide](./DEVELOPMENT.md)
- [API Documentation](./docs/api/README.md)
- [Testing Guide](./docs/TESTING_GUIDE.md)

### Configuration

- [Configuration Guide](./CONFIGURATION.md)
- [Environment Variables](./docs/configuration/environment.md)
- [Security Setup](./SECURITY.md)

### Deployment

- [Deployment Guide](./DEPLOYMENT.md)
- [Production Setup](./docs/deployment/production.md)
- [Docker Configuration](./infrastructure/docker/README.md)

---

## Summary

You now have a fully functional LabelMint development environment!

**What's available:**
- ✅ All services running locally
- ✅ Database configured and seeded
- ✅ Development tools ready
- ✅ Hot reloading enabled
- ✅ Testing framework configured

**Ready to develop:**
1. Explore the codebase structure
2. Read the development guide
3. Check out the API documentation
4. Start building features!

**Need help?**
- Check the troubleshooting section
- Review the detailed documentation
- Search GitHub Issues
- Join our developer community

Happy coding! 🚀