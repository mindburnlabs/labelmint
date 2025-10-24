# LabelMint Documentation

LabelMint is a Telegram-based data labeling platform that enables businesses to create labeling tasks and workers to complete them for TON/USDT rewards.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [API Documentation](#api-documentation)
4. [Deployment Guide](#deployment-guide)
5. [Configuration](#configuration)
6. [Contributing](#contributing)

## Architecture Overview

### System Components

```
┌─────────────────┐    ┌─────────────────┐
│   Client Bot    │    │  Worker Bot     │
│  (@LabelMintBot)│    │(@LabelMintWrkr)│
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          ▼                      ▼
┌─────────────────────────────────────────────┐
│           Backend API Server               │
│  - Task Assignment                         │
│  - Consensus Algorithm                     │
│  - Payment Processing                      │
│  - WebSocket Notifications                 │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌─────────────┐    ┌─────────────────┐
│ PostgreSQL  │    │      Redis      │
│   Database  │    │   Cache & Queue │
└─────────────┘    └─────────────────┘
```

### Frontend Applications

- **Web Dashboard** (`https://labelmint.mindburn.org`)
  - Project management interface
  - Analytics and reporting
  - Payment and billing

- **Telegram Mini Apps**
  - Client App (`https://app.labelmint.mindburn.org`)
  - Worker App (`https://workers.labelmint.mindburn.org`)

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Telegram Bot Tokens (2)
- TON Wallet

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/mindburn-labs/labelmint.git
cd labelmint
```

2. **Install dependencies**
```bash
# Install dependencies for all packages
npm install

# Install backend dependencies
cd services/labeling-backend
npm install
cd ../..

# Install web app dependencies
cd apps/web
npm install
cd ../..

# Install bot dependencies
cd services/bots/client-bot
npm install
cd ../../worker-bot
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Set up the database**
```bash
cd services/labeling-backend
npx prisma migrate dev
npx prisma generate
```

5. **Start the development environment**
```bash
# Start all services with Docker Compose
docker-compose up -d

# Or start services individually
npm run dev:backend
npm run dev:web
npm run dev:bots
```

## API Documentation

### Authentication

All API endpoints require authentication via JWT token:

```http
Authorization: Bearer <jwt_token>
```

### Core Endpoints

#### Projects

```http
GET    /api/projects           # List projects
POST   /api/projects           # Create project
GET    /api/projects/:id       # Get project details
PUT    /api/projects/:id       # Update project
DELETE /api/projects/:id       # Delete project
POST   /api/projects/:id/start # Start project
POST   /api/projects/:id/pause # Pause project
```

#### Tasks

```http
GET    /api/tasks/next         # Get next task for worker
POST   /api/tasks/:id/submit   # Submit task answer
POST   /api/tasks/:id/skip     # Skip task
POST   /api/tasks/:id/reserve  # Reserve task
```

#### Analytics

```http
GET    /api/analytics/projects/:id    # Project analytics
GET    /api/analytics/workers/:id     # Worker analytics
GET    /api/analytics/platform        # Platform analytics
```

### WebSocket Events

Real-time notifications via Socket.IO:

```javascript
// Client connection
socket.emit('authenticate', { token: 'jwt_token' });

// Listen for notifications
socket.on('notification', (data) => {
  // Handle notification
});

// Listen for task assignments (workers)
socket.on('task_available', (task) => {
  // Handle new task
});
```

## Deployment Guide

### Production Deployment

1. **Prepare server**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

2. **Configure environment**
```bash
# Create production environment file
cp .env.example .env.production

# Edit with production values
nano .env.production
```

3. **Deploy**
```bash
# Make deploy script executable
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh production
```

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| Nginx | 80, 443 | Reverse proxy & SSL |
| Web | 3000 | Dashboard frontend |
| Backend | 3001 | API server |
| Mini App | 3002 | Telegram Mini Apps |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache & queue |
| MinIO | 9000 | File storage |

### SSL Certificate Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d labelmint.mindburn.org -d api.labelmint.mindburn.org

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Configuration

### Environment Variables

#### Core Configuration
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/labelmint
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# TON Integration
TON_API_KEY=your-toncenter-api-key
TON_MERCHANT_ADDRESS=EQ...
USDT_MASTER_CONTRACT=EQ...

# Telegram Bots
TELEGRAM_BOT_TOKEN_CLIENT=your-client-bot-token
TELEGRAM_BOT_TOKEN_WORKER=your-worker-bot-token

# MinIO Storage
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_ENDPOINT=localhost:9000
```

#### Bot Configuration
```env
# Client Bot
WEB_APP_URL=https://app.labelmint.mindburn.org

# Worker Bot
WORKER_WEB_APP_URL=https://workers.labelmint.mindburn.org
```

### Database Schema

Key tables:
- `users` - User accounts
- `projects` - Labeling projects
- `tasks` - Individual labeling tasks
- `taskAnswers` - Worker submissions
- `workers` - Worker profiles
- `transactions` - Payment records
- `referrals` - Referral relationships

## Task Types

### Image Classification (IMG_CLS)
- Classify images into predefined categories
- Single label per image
- 3 judgments required for consensus

### Text Classification (TXT_CLS)
- Categorize text content
- Single label per text
- 3 judgments required for consensus

### RLHF Comparison (RLHF_PAIR)
- Compare AI model responses
- Select better response or tie
- 3 judgments required for consensus

### Bounding Box (BBOX)
- Draw boxes around objects
- Multiple objects per image
- IoU calculation for consensus

## Payment System

### Supported Currencies
- **TON** - Native TON cryptocurrency
- **USDT** - TON-based USDT stablecoin

### Withdrawal Process
1. Worker sets withdrawal address
2. Requests withdrawal with amount
3. System processes transaction
4. Funds sent to TON address

### Fee Structure
- Task payments: 5-12 USDT cents
- Withdrawal fees:
  - TON: 0.01 TON
  - USDT: 1 USDT

## Quality Control

### Consensus Algorithm
- Minimum 3 judgments per task
- Early stop at 2/2 agreement
- Quality check on disagreements

### Gold Tasks
- 15% of tasks are gold (known answers)
- Used to verify worker accuracy
- Failed gold tasks impact worker score

### Worker Levels
- **Bronze** (Level 1-10): Base rate
- **Silver** (Level 11-25): 2% bonus
- **Gold** (Level 26-50): 5% bonus
- **Platinum** (Level 51+): 10% bonus

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Development Workflow

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Build project
npm run build

# Start development
npm run dev
```

### Code Style

- Use TypeScript for all new code
- Follow Prettier configuration
- Write unit tests for new features
- Document public APIs

## Support

- **Documentation**: [https://docs.labelmint.mindburn.org](https://docs.labelmint.mindburn.org)
- **Support Chat**: [@LabelMintSupport](https://t.me/LabelMintSupport)
- **Bug Reports**: [GitHub Issues](https://github.com/mindburn-labs/labelmint/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.