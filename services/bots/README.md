# LabelMint Telegram Bots

Complete implementation of Telegram bots for the LabelMint data labeling marketplace with TON/USDT micropayments.

## 📋 Overview

This repository contains two fully-featured Telegram bots:

1. **Client Bot** (`/client-bot`) - For project managers to create and manage labeling projects
2. **Worker Bot** (`/worker-bot`) - For workers to complete tasks and earn money

## 🚀 Features

### Client Bot Features
- ✅ Project management (create, view, edit, delete)
- ✅ Real-time progress tracking via WebSocket
- ✅ File upload and data management
- ✅ Analytics and performance statistics
- ✅ Billing and payment integration
- ✅ Team management and collaboration
- ✅ Rich notifications system
- ✅ Multi-language support preparation
- ✅ Deep linking support

### Worker Bot Features
- ✅ Task browsing and filtering
- ✅ Gamification (XP, levels, streaks)
- ✅ Real-time task notifications
- ✅ Earnings tracking and withdrawal
- ✅ Achievement system
- ✅ Training modules
- ✅ Leaderboard and competitions
- ✅ Performance analytics
- ✅ Rating system

## 🏗️ Architecture

```
services/bots/
├── client-bot/          # Client Telegram bot
│   ├── src/
│   │   ├── handlers/    # Command handlers
│   │   ├── keyboards/   # Inline keyboards
│   │   ├── services/    # API integrations
│   │   ├── middleware/  # Auth, rate limiting
│   │   ├── scenes/      # Multi-step flows
│   │   └── utils/       # Helpers
│   ├── Dockerfile
│   └── package.json
├── worker-bot/          # Worker Telegram bot
│   ├── src/
│   │   ├── handlers/    # Command handlers
│   │   ├── keyboards/   # Inline keyboards
│   │   ├── services/    # API integrations
│   │   ├── middleware/  # Auth, rate limiting
│   │   ├── scenes/      # Multi-step flows
│   │   └── utils/       # Helpers
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 🛠️ Tech Stack

- **Framework**: Grammy (Telegram Bot Framework)
- **Language**: TypeScript
- **Session Storage**: Redis
- **Real-time**: WebSocket
- **Image Processing**: Sharp
- **Database**: PostgreSQL (via shared services)
- **Containerization**: Docker & Docker Compose

## 📦 Installation

### Prerequisites
- Node.js 20+
- pnpm 8+
- Redis
- PostgreSQL
- Docker & Docker Compose (optional)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/labelmint/labelmint.git
   cd labelmint/services/bots
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Redis**
   ```bash
   docker run -d --name redis -p 6379:6379 redis:7-alpine
   ```

5. **Run the bots**
   ```bash
   # Client bot
   cd client-bot
   pnpm dev

   # Worker bot (in another terminal)
   cd worker-bot
   pnpm dev
   ```

### Docker Deployment

1. **Build and start all services**
   ```bash
   docker-compose up -d
   ```

2. **View logs**
   ```bash
   docker-compose logs -f
   ```

3. **Stop services**
   ```bash
   docker-compose down
   ```

## ⚙️ Configuration

### Environment Variables

```bash
# Bot Tokens (get from @BotFather)
CLIENT_BOT_TOKEN=your_client_bot_token
WORKER_BOT_TOKEN=your_worker_bot_token

# API URLs
LABELING_API_URL=http://localhost:3001
PAYMENT_API_URL=http://localhost:3000
WS_URL=ws://localhost:3001

# Redis
REDIS_URL=redis://localhost:6379

# Features
ENABLE_ANALYTICS=true
ENABLE_NOTIFICATIONS=true
MIN_WITHDRAWAL_AMOUNT=5.00
```

### Bot Commands

#### Client Bot Commands
- `/start` - Main menu and onboarding
- `/projects` - View all projects
- `/create` - Create new project
- `/analytics` - View statistics
- `/billing` - Payment information
- `/team` - Manage team members
- `/notifications` - View notifications
- `/settings` - Configure preferences
- `/help` - Get help and support

#### Worker Bot Commands
- `/start` - Worker onboarding and verification
- `/tasks` - Available tasks list
- `/earnings` - Current balance and stats
- `/withdraw` - Request withdrawal
- `/profile` - Worker profile and stats
- `/leaderboard` - Top performers
- `/achievements` - Badges and milestones
- `/training` - Training modules
- `/help` - Worker support

## 🔌 API Integration

### Labeling Backend Endpoints
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/tasks/available` - Get available tasks
- `POST /api/tasks/{id}/complete` - Complete task
- `GET /api/users/profile` - User profile
- `GET /api/analytics/performance` - Performance stats

### Payment Backend Endpoints
- `GET /api/balance` - Get balance
- `POST /api/withdraw` - Request withdrawal
- `GET /api/transactions` - Transaction history
- `GET /api/earnings/stats` - Earnings stats

## 🌐 WebSocket Events

### Client Bot Events
- `task_completed` - Task completed notification
- `project_updated` - Project status change
- `payment_received` - Payment confirmation
- `worker_assigned` - Worker assigned to task
- `quality_alert` - Quality issue alert

### Worker Bot Events
- `new_task` - New task available
- `task_approved` - Task approval notification
- `payment_received` - Payment received
- `achievement_unlocked` - Achievement unlocked
- `rank_changed` - Rank promotion

## 📊 Monitoring & Logging

### Health Checks
- Client Bot: `GET /health`
- Worker Bot: `GET /health`

### Logging
Bots use structured logging with different levels:
- `error` - Errors and exceptions
- `warn` - Warning messages
- `info` - General information
- `debug` - Debug information

### Metrics
- Response time tracking
- Error rate monitoring
- Active user tracking
- Task completion metrics

## 🔒 Security

### Authentication
- Session-based authentication with Redis
- JWT token verification
- Rate limiting per user

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Secure session storage

## 🚀 Deployment

### Production Deployment

1. **Set up production environment**
   ```bash
   NODE_ENV=production
   LOG_LEVEL=info
   ```

2. **Configure webhooks**
   ```bash
   # Set webhook for each bot
   curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
     -d "url=https://your-domain.com/api/bot/webhook"
   ```

3. **Use reverse proxy (Nginx)**
   ```nginx
   server {
       listen 443 ssl;
       server_name your-domain.com;

       location /api/client-bot {
           proxy_pass http://client-bot:3000;
       }

       location /api/worker-bot {
           proxy_pass http://worker-bot:3001;
       }
   }
   ```

### Scaling

- **Horizontal scaling**: Use multiple bot instances behind a load balancer
- **Redis clustering**: For session storage scaling
- **Database optimization**: Read replicas for analytics queries

## 🧪 Testing

### Unit Tests
```bash
pnpm test
```

### Integration Tests
```bash
pnpm test:integration
```

### E2E Tests
```bash
pnpm test:e2e
```

## 📝 Development Guidelines

### Code Style
- Use TypeScript strictly
- Follow ESLint configuration
- Use descriptive variable names
- Add JSDoc comments for functions

### Git Workflow
- Feature branches for new features
- Pull requests for code review
- Semantic versioning for releases

### Contributing
1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit PR

## 🤝 Support

### Documentation
- [API Documentation](https://docs.labelmint.io)
- [Developer Guide](https://docs.labelmint.io/developers)
- [FAQ](https://docs.labelmint.io/faq)

### Contact
- Email: support@labelmint.io
- Telegram: @LabelMintSupport
- Discord: [Join our server](https://discord.gg/labelmint)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 Acknowledgments

- [Grammy](https://grammy.dev/) - Telegram Bot Framework
- [Redis](https://redis.io/) - In-memory data structure store
- [Docker](https://www.docker.com/) - Containerization platform
- The LabelMint community for feedback and support