# Project Context

## Purpose
LabelMint is a comprehensive Telegram-first data labeling marketplace that enables businesses to create high-quality training data through distributed workers. The platform connects clients needing labeled data with remote workers operating through Telegram bots and mini-apps, with TON/USDT micropayments for transparent compensation.

## Tech Stack
- **Runtime**: Node.js 20+ with TypeScript 5.7+ across all packages
- **Package Manager**: pnpm 9.15.1+ with workspace monorepo structure
- **Frontend**: Next.js 15+ (web app), React 19 + Vite (Telegram mini-app), Tailwind CSS
- **Backend**: Express.js microservices with PostgreSQL 15+ and Redis 7+
- **Database**: Prisma ORM with unified schema, PostgreSQL primary, Redis for caching/queues
- **Blockchain**: TON SDK for USDT micropayments, smart contracts for escrow
- **Telegram**: Grammy bots for client/worker interactions, Telegram Web App SDK
- **Infrastructure**: Docker, Kubernetes, AWS, monitoring with Prometheus/Grafana
- **Testing**: Vitest, Playwright, Jest with comprehensive test coverage
- **AI/ML**: Tesseract.js for OCR, Konva.js for image annotation, future Claude integration

## Project Conventions

### Code Style
- TypeScript `strict` mode with explicit return types on exported functions
- ESLint 9+ with `@typescript-eslint` presets and shared configurations
- Prettier with 2-space indentation, no semicolons in React components
- PascalCase for components/classes, camelCase for functions/variables, SCREAMING_SNAKE_CASE for constants
- File naming: kebab-case for files, descriptive names with clear purpose

### Architecture Patterns
- **Monorepo Structure**: `apps/` (Next.js applications), `services/` (Express backends), `packages/` (shared libraries)
- **Microservices**: Independent services with clear boundaries and API contracts
- **Event-Driven**: Asynchronous communication via message queues and event bus
- **API-First**: RESTful APIs with OpenAPI documentation and versioning
- **Database per Service**: Each service owns its data with clear interfaces
- **Shared Packages**: Common utilities, types, and UI components via `@labelmint/*` aliases

### Testing Strategy
- **Test Pyramid**: 70% unit tests, 20% integration tests, 10% E2E tests
- **Unit Tests**: Vitest with comprehensive coverage for business logic
- **Integration Tests**: API endpoints, database operations, service communication
- **E2E Tests**: Playwright for user journeys and critical workflows
- **Test Data**: Factories and fixtures for consistent test data generation
- **CI/CD**: Automated testing with GitHub Actions and quality gates

### Git Workflow
- **Branch Strategy**: Trunk-based development with feature branches
- **Naming**: `feature/`, `hotfix/`, `release/` prefixes with descriptive names
- **Commits**: Conventional Commits format (`feat:`, `fix:`, `chore:`, etc.)
- **Reviews**: Required PR reviews with automated checks and quality gates
- **Protection**: Branch protection rules for main branches with required status checks

## Domain Context
- **Core Business**: Data labeling marketplace connecting clients with distributed workers
- **Pricing Model**: Client pays per label, worker earns micropayments, platform takes margin
- **Quality Assurance**: Multi-worker consensus, honeypot tasks, accuracy scoring
- **Payment System**: TON/USDT micropayments with smart contract escrow
- **Task Types**: Image classification, text classification, bounding boxes, transcription, RLHF
- **Worker Management**: Telegram-based onboarding, skill assessment, reputation scoring
- **Client Experience**: Project creation, dataset upload, real-time progress tracking

## Important Constraints
- **Performance**: Sub-200ms response times, horizontal scaling capability
- **Security**: End-to-end encryption, audit trails, compliance with data privacy laws
- **Reliability**: 99.9% uptime, fault tolerance, graceful degradation
- **Scalability**: Handle thousands of concurrent tasks and users
- **Compliance**: Financial regulations, data protection, audit requirements
- **User Experience**: Intuitive interfaces, mobile-first design, accessibility

## External Dependencies
- **Telegram**: Bot API, Web App SDK, payment processing
- **Blockchain**: TON network, USDT tokens, smart contracts
- **Cloud**: AWS infrastructure, S3 storage, managed databases
- **Monitoring**: Prometheus, Grafana, Sentry for observability
- **Development**: Docker, Kubernetes, GitHub Actions for CI/CD
- **Future**: Claude API for AI assistance, Wise API for bank payouts

## Development Environment
- **Requirements**: Node.js 20+, pnpm 9.15.1+, Docker, Git
- **Setup**: `pnpm install` → `pnpm run dev` for full development environment
- **Services**: PostgreSQL, Redis, MinIO via Docker Compose
- **Scripts**: 
  - `pnpm run dev` - Start all services
  - `pnpm run test` - Run test suites
  - `pnpm run lint` - Code quality checks
  - `pnpm run type-check` - TypeScript validation
- **Database**: Prisma migrations and seeding for development data
- **Shared Packages**: `@labelmint/shared`, `@labelmint/ui` for common functionality

## Project Structure
```
labelmint/
├── apps/                          # Frontend applications
│   ├── web/                      # Next.js main web application
│   ├── admin/                     # Next.js admin dashboard
│   └── telegram-mini-app/        # Vite + React Telegram mini-app
├── services/                     # Backend microservices
│   ├── api-gateway/              # API Gateway with routing
│   ├── labeling-backend/         # Core task management service
│   ├── payment-backend/          # TON/USDT payment processing
│   ├── bots/                     # Telegram bot services
│   ├── enterprise-api/           # Enterprise features
│   ├── workflow-engine/          # Workflow automation
│   ├── collaboration-service/    # Team collaboration
│   ├── analytics-engine/         # Analytics and reporting
│   └── white-label-service/      # White-label customization
├── packages/                     # Shared packages
│   ├── shared/                   # Common utilities and types
│   └── ui/                       # Reusable UI components
├── config/                       # Configuration files
├── infrastructure/               # Infrastructure as code
├── docs/                         # Documentation
├── tests/                        # Global test configuration
├── scripts/                      # Utility scripts
└── openspec/                     # OpenSpec specifications
```
