# LabelMint Development Guide

This guide covers all aspects of developing LabelMint, from setup to deployment.

## Table of Contents

- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Docker Development](#docker-development)
- [Environment Configuration](#environment-configuration)
- [Code Standards](#code-standards)
- [Git Workflow](#git-workflow)
- [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd labelmint
pnpm install

# Start development environment
pnpm run dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9.15.1+
- Docker & Docker Compose
- Git

### Environment Setup

1. Copy the appropriate environment template:
```bash
cp config/environment/.env.development .env.local
```

2. Update the environment variables in `.env.local` with your development settings.

3. Start the development infrastructure:
```bash
docker-compose -f docker-compose.unified.yml -f config/docker/development.yml up -d
```

### IDE Setup

We recommend using VS Code with the following extensions:
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Docker
- GitLens

## Project Structure

```
labelmint/
├── apps/                    # Frontend applications
│   ├── web/                # Next.js web application
│   ├── admin/              # Admin dashboard
│   └── telegram-mini-app/  # Telegram mini-app
├── services/               # Backend services
│   ├── api-gateway/        # API gateway
│   ├── labeling-backend/   # Core labeling service
│   ├── payment-backend/    # Payment processing
│   └── bots/               # Telegram bots
├── packages/               # Shared packages
│   ├── shared/             # Shared utilities and types
│   ├── ui/                 # UI component library
│   └── clients/            # API clients
├── tests/                  # Test files (consolidated)
├── config/                 # Configuration files
│   ├── docker/             # Docker configurations
│   ├── environment/        # Environment variables
│   └── shared/             # Shared configurations
├── scripts/                # Build and deployment scripts
├── docs/                   # Documentation
└── infrastructure/         # Infrastructure as code
```

## Available Scripts

### Development

```bash
pnpm dev              # Start all services in development mode
pnpm dev:web          # Start only web application
pnpm dev:backend      # Start only backend services
```

### Building

```bash
pnpm build            # Build all packages and applications
pnpm build:web        # Build only web application
pnpm build:backend    # Build only backend services
```

### Testing

```bash
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests
pnpm test:integration # Run integration tests
pnpm test:e2e         # Run end-to-end tests
pnpm test:frontend    # Run frontend tests
pnpm test:backend     # Run backend tests
pnpm test:coverage    # Generate coverage report
```

### Code Quality

```bash
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm format           # Format code with Prettier
pnpm type-check       # Run TypeScript type checking
```

### Database

```bash
pnpm db:start         # Start database services
pnpm db:stop          # Stop database services
pnpm db:reset         # Reset database
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed database with test data
```

## Testing

### Test Structure

Tests are organized by type:

- **Unit Tests**: `tests/unit/` - Test individual functions and components
- **Integration Tests**: `tests/integration/` - Test service interactions
- **E2E Tests**: `tests/e2e/` - Test complete user workflows
- **Performance Tests**: `tests/performance/` - Load and performance testing

### Running Tests

#### Unit Tests
```bash
pnpm test:unit
# or for watch mode
pnpm test:unit --watch
```

#### Integration Tests
```bash
# Requires test infrastructure
docker-compose -f docker-compose.unified.yml -f config/docker/testing.yml up -d
pnpm test:integration
```

#### E2E Tests
```bash
# Requires full infrastructure
pnpm test:e2e
```

### Test Configuration

Tests use Jest with configurations for different environments. See `jest.config.js` for detailed configuration.

## Docker Development

### Development Environment

```bash
# Start all services
docker-compose -f docker-compose.unified.yml -f config/docker/development.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Testing Environment

```bash
# Start test infrastructure
docker-compose -f docker-compose.unified.yml -f config/docker/testing.yml up -d

# Run tests against test environment
pnpm test

# Clean up test environment
docker-compose down -v
```

### Production Environment

```bash
# Deploy to production
./scripts/deployment/deploy.sh production
```

## Environment Configuration

### Environment Files

- `.env.development` - Development environment variables
- `.env.testing` - Testing environment variables
- `.env.production` - Production environment variables

### Key Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@localhost:5432/db` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `TON_API_KEY` | TON API key | `your-ton-api-key` |

## Code Standards

### TypeScript

- Use strict mode
- Provide explicit return types
- Use interfaces for object shapes
- Prefer `const` over `let`
- Use arrow functions for callbacks

### ESLint & Prettier

Code is automatically formatted and linted. Run `pnpm lint:fix` before committing.

### Naming Conventions

- Files: kebab-case (`user-service.ts`)
- Components: PascalCase (`UserService.tsx`)
- Variables: camelCase (`userName`)
- Constants: UPPER_SNAKE_CASE (`API_BASE_URL`)
- Interfaces: PascalCase with `I` prefix (`IUserService`)

## Git Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature branches
- `hotfix/*` - Emergency fixes

### Commit Messages

Follow conventional commits:

```
type(scope): description

feat(auth): add user authentication
fix(api): resolve user creation bug
docs(readme): update installation guide
```

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes with descriptive commits
3. Ensure all tests pass
4. Create pull request to `develop`
5. Request code review
6. Merge after approval

## Deployment

### Automated Deployment

The project uses GitHub Actions for CI/CD. See `.github/workflows/unified-ci.yml`.

### Manual Deployment

```bash
# Deploy to specific environment
./scripts/deployment/deploy.sh staging
./scripts/deployment/deploy.sh production

# Deploy specific service
./scripts/deployment/deploy.sh development --service web

# Rollback deployment
./scripts/deployment/deploy.sh production --rollback
```

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using ports
lsof -i :3000
lsof -i :5432

# Kill processes
kill -9 <PID>
```

#### Docker Issues
```bash
# Reset Docker
docker system prune -a
docker-compose down -v
docker-compose up --build
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

#### Dependency Issues
```bash
# Clear node modules
rm -rf node_modules
pnpm install

# Clear pnpm cache
pnpm store prune
```

### Getting Help

- Check the [GitHub Issues](https://github.com/your-org/labelmint/issues)
- Read the [API Documentation](./api/README.md)
- Review the [Deployment Guide](./deployment/README.md)

### Performance Tips

- Use `pnpm` for faster package management
- Enable Docker's build cache for faster builds
- Use test infrastructure isolation for parallel testing
- Monitor resource usage during development