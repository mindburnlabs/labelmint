# Project Context

## Purpose
Build a Telegram-first data labeling marketplace that lets clients spin up labeling projects, fund them, and receive labeled datasets within days while remote workers earn through Telegram bots and a mini-app. The immediate goal is to launch an MVP within 7 days and reach first revenue by connecting both sides quickly.

## Tech Stack
- TypeScript everywhere within a `pnpm` workspace monorepo
- `grammy`-based Telegram bots for clients and workers
- React 19 + Vite mini app using Telegram Web App SDK (@twa-dev/sdk, @telegram-apps/sdk-react)
- Express REST backend with direct PostgreSQL connection (pg) and Redis client
- PostgreSQL 16 (primary datastore) and Redis 7 (task reservations, queues)
- Docker Compose for local orchestration
- TON blockchain integration (@ton/core, @ton/crypto, @ton/ton) for crypto payments
- Stripe / Telegram Payments for deposits, manual payouts initially
- OCR capabilities via Tesseract.js for text recognition tasks
- Image annotation via Konva.js + react-konva for bounding box tasks
- Future: Wise API, TON/USDT payouts, Claude API assistive labeling

## Project Conventions

### Code Style
- TypeScript `strict` mode across packages; favor explicit return types on exported functions
- ESLint with `@typescript-eslint` presets and shared config published from `/shared`
- Prettier with default 2-space indentation; no semicolons in React components, semicolons allowed elsewhere
- Components and classes use PascalCase, functions and variables use camelCase, constants adopting SCREAMING_SNAKE_CASE

### Architecture Patterns
- Monorepo layout: `/telegram-labeling-platform/bot`, `/telegram-labeling-platform/mini-app`, `/telegram-labeling-platform/backend`, `/telegram-labeling-platform/shared` with shared types/utilities published via local workspace versions
- Backend exposes REST endpoints (`/api/tasks`, `/api/projects`, `/api/v1/...`) consumed by bots, mini-app, and external clients
- Bots remain thin: validate commands, delegate business rules to backend, communicate via webhooks in production and long polling locally
- Task distribution relies on Redis-backed reservation locks and honeypot tagging; consensus logic centralised in backend services
- Mini-app uses React Router for navigation, Telegram UI components (@telegram-apps/telegram-ui) for native feel
- Direct database connections without ORM for performance: pg for PostgreSQL, redis for caching/queues
- Future enhancements (Claude assistive labeling, payouts) integrate as composable service modules behind clear interfaces

### Testing Strategy
- Custom Node.js test scripts in `/test` directory: endpoints.test.js, enhanced-features-test.js, ai-features-test.js, growth-automation-test.js, viral-features-test.js
- Manual QA sessions for Telegram bot flows and mini-app UX during daily development cadence
- Database initialization via bot/scripts/init-db.sql for Docker Compose setup
- Test data seeding via bot/scripts/init-db.ts for development environments
- Future: CI/CD pipeline with automated testing before deployment

### Git Workflow
- Trunk-based around `main`; short-lived feature branches prefixed by scope (`bot/`, `backend/`, `mini-app/`, `infra/`)
- Prefer pull requests even for solo work to document context; urgent fixes may fast-forward with self-review
- Conventional Commits (`feat:`, `fix:`, `chore:` etc.) for consistent history and automated changelog potential

## Domain Context
- Marketplace connects clients needing labeled data (image/text classification, bounding boxes, transcription) with distributed workers operating inside Telegram
- Pricing: client pays $0.05 per label, worker earns $0.02, platform retains $0.03 margin; invoices handled via Telegram Payments / Stripe
- Quality pipeline: each task needs three labels, consensus at 2/3; conflicting labels trigger extra reviewers; honeypot tasks evaluate worker accuracy
- Worker lifecycle: Telegram registration, balance tracking, manual withdrawals (bank/crypto) until automation completes; trust score impacts task allocation
- Client onboarding flow includes dataset ingestion (file upload or links), category definition, automatic task creation, and real-time progress dashboards
- Supported task types: image classification, text classification, bounding box annotation (via Konva), text transcription/OCR (via Tesseract.js)
- Future roadmap includes RLHF tasks, enterprise API access, multilingual bots, AI-assisted pre-labeling, and gamified worker incentives

## Important Constraints
- MVP must ship inside 7 days; prioritize working vertical slices over full feature completeness
- Telegram Bot API rate limits apply; need webhook hosting for production and secure secret storage
- Handle payments compliantly; Stripe/Telegram invoices must match delivered label counts and transaction records in PostgreSQL
- Data privacy: datasets may contain sensitive client content; ensure secure storage and controlled access for workers
- System must scale to thousands of concurrent micro-tasks; reservation logic must prevent double assignment and honor 30-second holds
- Reliability of consensus metrics directly affects payouts and client trust—avoid regressions when iterating

## External Dependencies
- Telegram Bot API (client and worker bots) and Telegram Web App SDK
- Grammy ecosystem for bot development (@grammyjs/conversations, @grammyjs/menu, @grammyjs/sessions)
- Stripe (via Telegram Payments provider) for client deposits
- PostgreSQL 16 (primary database) and Redis 7 (reservations, queues, caching)
- OCR processing: Tesseract.js for text recognition tasks
- Image annotation: Konva.js + react-konva for bounding box drawing
- TON blockchain infrastructure (@ton/core, @ton/crypto, @ton/ton, @tonconnect/sdk)
- Deployment platforms: Railway (bot), Vercel (mini-app), Fly.io (backend)
- Future integrations: Wise API (bank payouts), USDT blockchain payments, Claude API for pre-labeling and validation, Google Drive ingestion for datasets

## Development Environment
- Node.js >=20.0.0 and pnpm >=9.0.0 required (see package.json engines)
- Use `pnpm run docker:up` to start PostgreSQL and Redis containers locally
- Environment variables: Copy `.env.example` to appropriate `.env` files in each package
- Local development scripts:
  - `pnpm run dev` - Start all services in watch mode
  - `pnpm run bot:dev`, `pnpm run backend:dev`, `pnpm run mini-app:dev` - Start individual services
  - `pnpm run test:all` - Run all test suites (endpoints, enhanced features, AI features, growth automation, viral features)
- Database schema initialized via Docker Compose entrypoint: `bot/scripts/init-db.sql`
- Shared package (`@telegram-labeling/shared`) contains common types and utilities

## Project Structure
```
telegram-labeling-platform/
├── bot/                 # Grammy Telegram bot source code
│   ├── src/
│   │   ├── scripts/     # Database initialization scripts
│   │   └── server.ts    # Webhook server for production
│   └── Dockerfile
├── backend/             # Express REST API
│   └── src/
├── mini-app/           # React 19 + Vite Telegram Mini App
│   └── src/
├── shared/             # Shared TypeScript types and utilities
│   └── src/
├── test/               # Integration and feature test suites
├── contracts/          # Smart contracts (future TON integration)
├── docs/               # Project documentation
├── docker-compose.yml  # Local development orchestration
└── pnpm-workspace.yaml # Monorepo workspace configuration
```
