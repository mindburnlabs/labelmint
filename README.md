# 🚀 LabelMint - Telegram Data Labeling Platform

A comprehensive platform for data labeling powered by Telegram and TON/USDT micropayments. Built for scalability, security, and exceptional developer experience.

## 🎯 Overview

**LabelMint** is a modern data labeling platform that enables businesses to create high-quality training data through:
- 🤖 **Telegram Bot Integration** - Intuitive task management via familiar interface
- 💰 **TON Blockchain Payments** - Secure, transparent micropayments in USDT
- 🔒 **Enterprise Security** - End-to-end encryption and audit trails
- 📊 **Real-time Analytics** - Comprehensive insights and reporting
- 🌐 **Multi-tenant Support** - Scalable architecture for teams of all sizes

## ⭐ Key Features

### 🎨 **Intuitive User Experience**
- **Telegram Mini App** for seamless task completion
- **Progressive Web App** with offline capabilities
- **Responsive Design** optimized for all devices
- **Real-time Updates** via WebSocket connections

### 💳 **Smart Payment System**
- **USDT Micropayments** via TON blockchain
- **Smart Contracts** for transparent escrow
- **Automated Dispute Resolution** with consensus mechanisms
- **Multi-wallet Support** for enhanced flexibility

### 🏗️ **Robust Architecture**
- **Microservices Design** for independent scaling
- **Event-driven Communication** via message queues
- **Database Replication** for high availability
- **Auto-scaling Infrastructure** on Kubernetes

### 🔒 **Enterprise Security**
- **End-to-end Encryption** for all data
- **Role-based Access Control** (RBAC)
- **Audit Logging** for compliance
- **SOC 2 Type II** certified infrastructure

## 🏛️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telegram Bot  │    │   Web Client    │    │   Admin Panel   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
          ┌──────────────────────┴──────────────────────┐
          │              API Gateway                    │
          └──────────────────────┬──────────────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                            │                            │
┌───▼───┐    ┌───────────┐    ┌────▼────┐    ┌─────────────┐
│Tasks  │    │ Payments  │    │ Users   │    │ Consensus   │
│Service│    │ Service   │    │ Service │    │ Engine      │
└───────┘    └───────────┘    └─────────┘    └─────────────┘
```

### 📦 Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, PostgreSQL, Redis
- **Blockchain**: TON SDK, Smart Contracts
- **Infrastructure**: Docker, Kubernetes, AWS
- **Monitoring**: Prometheus, Grafana, Sentry
- **Testing**: Jest, Playwright, E2E Testing

## 🚀 Quick Start

### 📋 Prerequisites

- **Node.js** 18.0+ and pnpm
- **Docker** and Docker Compose
- **Git** and GitHub CLI
- **Supabase CLI** (for database management)
- **Telegram Bot Token** (from @BotFather)
- **TON Wallet** (for payment processing)

### ⚡ 5-Minute Setup

1. **Clone Repository**
   ```bash
   git clone https://github.com/mindburn-labs/labelmint.git
   cd labelmint
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Setup Environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Start Services**
   ```bash
   pnpm run dev
   ```

5. **Access Applications**
   - **Web App**: http://localhost:3000
   - **Admin Panel**: http://localhost:3001
   - **API Documentation**: http://localhost:3002/docs

## 📖 Documentation

### 🎯 Core Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](./SETUP.md) | 🛠️ Complete installation and development setup |
| [SECURITY.md](./SECURITY.md) | 🔐 Security policies and procedures |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 🚀 Production deployment procedures |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 🏗️ System architecture and design |
| [CONFIGURATION.md](./CONFIGURATION.md) | ⚙️ Configuration management |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 👨‍💻 Development workflow and standards |

### 📚 Specialized Documentation

```
docs/
├── api/               # API Documentation
│   ├── README.md      # API Overview
│   ├── tasks.md       # Tasks API
│   └── versioning-strategy.md
├── runbooks/          # Operational Procedures
│   ├── README.md      # Operations Guide
│   ├── incident-response.md
│   └── scaling-procedures.md
└── architecture/      # Technical Architecture
    └── overview.md
```

## 🔧 Development

### 🌟 Local Development Workflow

1. **Environment Setup**
   ```bash
   # Start all services
   pnpm run dev
   ```

2. **Database Management**
   ```bash
   # Run migrations
   pnpm run db:migrate

   # Seed development data
   pnpm run db:seed
   ```

3. **Testing**
   ```bash
   # Run all tests
   pnpm run test

   # E2E testing
   pnpm run test:e2e

   # Type checking
   pnpm run type-check
   ```

4. **Code Quality**
   ```bash
   # Linting
   pnpm run lint

   # Format code
   pnpm run format
   ```

### 📁 Project Structure

```
labelmint/
├── apps/                    # Next.js Applications
│   ├── web/                # Main web application
│   ├── admin/              # Admin dashboard
│   └── telegram-mini-app/  # Telegram Mini App
├── services/               # Backend Services
│   ├── api-gateway/        # API Gateway
│   ├── tasks/              # Task management service
│   ├── payments/           # Payment processing service
│   └── users/              # User management service
├── packages/               # Shared Packages
│   ├── shared/             # Shared utilities
│   ├── ui/                 # UI components
│   └── config/             # Shared configuration
├── infrastructure/         # Infrastructure as Code
│   ├── k8s/                # Kubernetes manifests
│   ├── terraform/          # AWS infrastructure
│   └── monitoring/         # Monitoring configuration
└── docs/                   # Documentation
```

## 🚢 Deployment

### 🌐 Environment Strategy

| Environment | Purpose | URL |
|-------------|---------|-----|
| **Development** | Local development & testing | `localhost` |
| **Staging** | Pre-production validation | `staging.labelmint.com` |
| **Production** | Live production environment | `labelmint.com` |

### 📋 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates configured
- [ ] Monitoring and alerts enabled
- [ ] Security scans completed
- [ ] Performance tests passed

📖 **See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment procedures.**

## 🔒 Security

### 🛡️ Security Features

- **End-to-end Encryption** for all data
- **Multi-factor Authentication** (MFA)
- **Role-based Access Control** (RBAC)
- **Security Audit Logs**
- **Vulnerability Scanning**
- **Compliance Certifications** (SOC 2, GDPR, PCI DSS)

### 🚨 Incident Response

- **24/7 Monitoring** with automated alerts
- **Security Team** on-call rotation
- **Incident Response** procedures
- **Communication Templates** for stakeholders

📖 **See [SECURITY.md](./SECURITY.md) for complete security documentation.**

## 📊 Monitoring & Observability

### 📈 Metrics and Monitoring

- **Application Performance Monitoring** (APM)
- **Infrastructure Monitoring** with Prometheus
- **Log Aggregation** with Loki
- **Error Tracking** with Sentry
- **User Analytics** with custom dashboard

### 🔍 Health Checks

- **Service Health** endpoints
- **Database Connectivity** checks
- **External API** availability
- **Performance Benchmarks**
- **Security Scans** automation

## 🤝 Contributing

We welcome contributions from the community! Please see our [Development Guide](./DEVELOPMENT.md) for detailed information on:

- 🎯 **Development Setup** and environment configuration
- 📝 **Coding Standards** and best practices
- 🔧 **Testing Guidelines** and quality assurance
- 📤 **Pull Request Process** and code review
- 🏗️ **Architecture Decisions** and design patterns

### 🚀 Quick Contribution Steps

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### 📞 Get Help

- **📚 Documentation**: [docs/](./docs/) directory
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/your-org/labelmint/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/your-org/labelmint/discussions)
- **📧 Email**: support@labelmint.com
- **🔔 Discord**: [Join our Discord](https://discord.gg/labelmint)

### 📋 Resources

- **📖 Developer Guide**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **🔧 Configuration Guide**: [CONFIGURATION.md](./CONFIGURATION.md)
- **🚀 Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **🔐 Security Guide**: [SECURITY.md](./SECURITY.md)
- **📊 API Documentation**: [docs/api/README.md](./docs/api/README.md)

---

<div align="center">

**🌟 Made with ❤️ by the LabelMint Team**

Built for developers who value **security**, **scalability**, and **exceptional user experience**.

[![GitHub stars](https://img.shields.io/github/stars/your-org/labelmint)](https://github.com/your-org/labelmint)
[![GitHub forks](https://img.shields.io/github/forks/your-org/labelmint)](https://github.com/your-org/labelmint)
[![GitHub license](https://img.shields.io/github/license/your-org/labelmint)](https://github.com/your-org/labelmint)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript)](https://www.typescriptlang.org/)

</div>