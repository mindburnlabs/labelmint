<div align="center">

# 🏷️ LabelMint

**Telegram Data Labeling Platform with TON/USDT Micropayments**

*Tap. Confirm. Mint the truth.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![PNPM](https://img.shields.io/badge/PNPM-9+-red.svg)](https://pnpm.io/)

A three-tier Telegram ecosystem for data labeling at scale: Client Bot, Labeler Mini-App, and Backend with TON/USDT micropayments.

</div>

## ✨ Features

### 🤖 AI-Assisted Labeling
- **Smart Pre-labeling**: Claude AI integration for automated suggestions
- **Quality Control**: Multi-worker consensus system with confidence scoring
- **Adaptive Learning**: AI improves from worker corrections over time

### 💳 TON Blockchain Integration
- **Instant Payments**: USDT and TON wallet integration
- **Transparent Transactions**: All payments recorded on blockchain
- **Global Access**: Borderless payments for worldwide workforce

### 📱 Telegram Integration
- **Native Mini-App**: Seamless mobile labeling experience
- **Bot Notifications**: Real-time task updates and payment alerts
- **Viral Growth**: Built-in referral and gamification system

### 🎯 Advanced Task Management
- **Multiple Annotation Types**: Bounding boxes, polygons, text classification, and more
- **Real-time Collaboration**: Live task assignment and progress tracking
- **Quality Scoring**: Comprehensive worker performance metrics

### 📊 Analytics & Monitoring
- **Performance Dashboard**: Real-time project analytics
- **Worker Insights**: Detailed accuracy and speed metrics
- **Financial Tracking**: Complete payment and earning analytics

## 🏗️ Architecture

```
labelmint/
├── apps/                    # Frontend applications
│   ├── web/                # Next.js web application
│   ├── telegram-mini-app/  # Vite-based Telegram mini-app
│   └── admin/              # Admin dashboard
├── services/               # Backend services
│   ├── labeling-backend/   # Primary labeling service
│   ├── payment-backend/    # TON payment processing
│   └── api-gateway/        # API gateway (future)
├── packages/               # Shared libraries
│   ├── shared/            # Common utilities and types
│   ├── ui/                # Shared components
│   └── clients/           # API clients
└── infrastructure/         # DevOps and deployment
    ├── docker/            # Docker configurations
    ├── k8s/               # Kubernetes manifests
    └── monitoring/        # Observability stack
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Docker** and **Docker Compose**
- **PostgreSQL** client (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/mindburn-labs/labelmint.git
cd labelmint

# Copy environment template
cp .env.example .env

# Install dependencies
pnpm install

# Start all services
pnpm run dev
```

### Development Setup

```bash
# Start infrastructure services only
pnpm run docker:up

# Start backend services
pnpm run services:up

# Start frontend applications
pnpm run apps:up

# Start everything at once
./scripts/dev/start-all.sh
```

### Access Points

| Service                | URL                      |
|------------------------|--------------------------|
| Web Application        | http://localhost:3002    |
| Telegram Mini App      | http://localhost:5173    |
| Labeling Backend API   | http://localhost:3001    |
| Payment Backend API    | http://localhost:3000    |
| PostgreSQL             | localhost:5432          |
| Redis                  | localhost:6379          |
| Grafana Dashboard      | http://localhost:3003    |
| MinIO Console          | http://localhost:9001    |
| MailHog (Email Testing)| http://localhost:8025    |

## 📚 Documentation

- [📖 Architecture Overview](docs/architecture/overview.md)
- [🔧 API Documentation](docs/api/)
- [🚀 Deployment Guide](docs/deployment/production.md)
- [👥 Contributing Guidelines](docs/development/contributing.md)
- [❓ Troubleshooting](docs/development/troubleshooting.md)

## 🛠️ Development Commands

```bash
# Package Management
pnpm install              # Install all dependencies
pnpm update               # Update dependencies
pnpm clean                # Clean all node_modules

# Development
pnpm dev                  # Start all applications
pnpm build                # Build all applications
pnpm test                 # Run all tests
pnpm test:watch           # Run tests in watch mode
pnpm test:e2e             # Run end-to-end tests

# Code Quality
pnpm lint                 # Lint all code
pnpm lint:fix             # Fix linting issues
pnpm format               # Format code with Prettier
pnpm type-check           # Type checking

# Database
pnpm db:generate          # Generate Prisma client
pnpm db:migrate           # Run migrations
pnpm db:push              # Push schema to database
pnpm db:seed              # Seed database with sample data
pnpm db:studio            # Open Prisma Studio

# Docker
pnpm docker:build         # Build all Docker images
pnpm docker:up            # Start Docker containers
pnpm docker:down          # Stop Docker containers
```

## 🧪 Testing

```bash
# Unit Tests
pnpm test                 # Run all unit tests
pnpm test:unit            # Run unit tests only
pnpm test:integration     # Run integration tests

# E2E Tests
pnpm test:e2e             # Run Playwright tests
pnpm test:e2e:ui          # Run tests with UI

# Coverage
pnpm test:coverage        # Generate coverage report
pnpm test:coverage:open   # Open coverage report
```

## 📦 Tech Stack

### Frontend
- **Next.js 16** - React framework
- **Vite** - Build tool and dev server
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **Framer Motion** - Animations
- **Konva.js** - Canvas-based image annotation

### Backend
- **Node.js 20** - Runtime environment
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching and sessions
- **Socket.io** - Real-time communication
- **AWS S3** - File storage

### Blockchain
- **TON Blockchain** - Payment processing
- **@ton/core** - TON SDK
- **@tonconnect/sdk** - TON Connect integration

### DevOps & Monitoring
- **Docker** - Containerization
- **Kubernetes** - Orchestration
- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **GitHub Actions** - CI/CD

## 🤝 Contributing

LabelMint is built by **MindBurn Labs**. We welcome contributions! Please read our [Contributing Guide](docs/development/contributing.md) for details on our code of conduct and the process for submitting pull requests.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run tests: `pnpm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **TON Foundation** - Blockchain infrastructure support
- **Claude AI** - Advanced labeling assistance
- **Telegram** - Platform integration
- **OpenAI** - AI model integration
- **Vercel** - Hosting and deployment support

## 📞 Contact

- **Website**: [labelmint.mindburn.org](https://labelmint.mindburn.org)
- **Telegram Bots**: @LabelMintBot (Client), @LabelMintWorkerBot (Worker)
- **Email**: team@mindburn.org
- **GitHub Issues**: [Report Bug](https://github.com/mindburn-labs/labelmint/issues)
- **Discussions**: [Community Forum](https://github.com/mindburn-labs/labelmint/discussions)

---

<div align="center">

Made with ❤️ by MindBurn Labs

</div>