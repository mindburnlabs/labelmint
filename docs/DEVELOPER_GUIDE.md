# LabelMint Developer Guide

This guide helps developers understand the LabelMint codebase and contribute effectively.

## Project Structure

```
labelmint/
├── apps/
│   ├── web/                    # Next.js dashboard
│   └── telegram-mini-app/      # Telegram mini-apps
├── services/
│   ├── labeling-backend/       # Main API server
│   └── bots/
│       ├── client-bot/         # Client Telegram bot
│       └── worker-bot/         # Worker Telegram bot
├── docs/                       # Documentation
├── scripts/                    # Utility scripts
├── nginx/                      # Nginx configuration
└── docker-compose.yml          # Docker configuration
```

## Tech Stack

### Backend
- **Node.js** with TypeScript
- **Express.js** for REST API
- **Socket.IO** for WebSocket
- **Prisma** as ORM
- **PostgreSQL** as primary database
- **Redis** for caching and queues

### Frontend
- **Next.js 14** with App Router
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Recharts** for charts

### Bots
- **Grammy** framework
- **Node.js** with TypeScript

### Infrastructure
- **Docker** & Docker Compose
- **Nginx** reverse proxy
- **MinIO** for file storage

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm package manager
- Docker & Docker Compose
- PostgreSQL client tool
- Redis CLI

### Local Development Setup

1. **Install dependencies**
```bash
# Root dependencies
pnpm install

# Backend
cd services/labeling-backend
pnpm install

# Web app
cd apps/web
pnpm install

# Bots
cd services/bots/client-bot
pnpm install
cd ../../worker-bot
pnpm install
```

2. **Set up databases**
```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Run migrations
cd services/labeling-backend
pnpm prisma migrate dev
pnpm prisma db seed
```

3. **Configure environment**
```bash
# Copy environment files
cp .env.example .env
cp services/labeling-backend/.env.example .env
cp apps/web/.env.example .env.local

# Edit with your values
```

4. **Start development servers**
```bash
# Terminal 1 - Backend
cd services/labeling-backend
pnpm dev

# Terminal 2 - Web app
cd apps/web
pnpm dev

# Terminal 3 - Client bot
cd services/bots/client-bot
pnpm dev

# Terminal 4 - Worker bot
cd services/bots/worker-bot
pnpm dev
```

## Key Concepts

### Task Assignment

The task assignment system ensures fair distribution of tasks:

1. **Worker Eligibility** - Minimum accuracy and task count
2. **Priority Scoring** - Based on age, project priority, and worker level
3. **Reservation System** - Tasks reserved for 30 seconds
4. **Quality Control** - 15% gold tasks for verification

### Consensus Algorithm

Tasks require multiple judgments for consensus:

```typescript
interface ConsensusConfig {
  requiredJudgments: number;    // Usually 3
  consensusThreshold: number;   // Usually 2
  earlyStop: boolean;          // Stop at 2/2 agreement
  goldTaskFrequency: number;    // 0.15 (15%)
}
```

### Payment Processing

Integrated with TON blockchain:

1. **Deposits** - Users send TON/USDT to merchant address
2. **Task Payments** - Workers earn per task
3. **Withdrawals** - Processed to TON addresses
4. **Fees** - Small withdrawal fees apply

### WebSocket Notifications

Real-time updates for:
- Task assignments
- Project status changes
- Payment notifications
- Achievement unlocks

## Database Schema

### Core Models

```typescript
// Project
model Project {
  id          String   @id @default(cuid())
  title       String
  description String?
  type        TaskType
  status      ProjectStatus @default(DRAFT)
  ownerId     String
  budget      Float
  // ... other fields
}

// Task
model Task {
  id        String   @id @default(cuid())
  projectId String
  type      TaskType
  status    TaskStatus @default(PENDING)
  gold      Boolean  @default(false)
  goldAnswer String?
  // ... other fields
}

// Task Answer
model TaskAnswer {
  id         String   @id @default(cuid())
  taskId     String
  workerId   String
  answer     Json
  isCorrect  Boolean?
  timeSpentMs Int
  earnings   Float    @default(0)
  // ... other fields
}
```

## API Architecture

### Routes Structure

```
/api/
├── auth/           # Authentication
├── projects/       # Project management
├── tasks/          # Task operations
├── workers/        # Worker management
├── payments/       # Payment processing
├── analytics/      # Analytics data
└── admin/          # Admin operations
```

### Middleware

- **Authentication** - JWT verification
- **Rate Limiting** - Request throttling
- **Validation** - Input validation
- **Error Handling** - Centralized error handling

### Response Format

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}
```

## Bot Development

### Grammy Framework

Bots use Grammy for Telegram integration:

```typescript
import { Bot, GrammyContext } from 'grammy';

const bot = new Bot(process.env.BOT_TOKEN);

// Command handlers
bot.command('start', async (ctx: GrammyContext) => {
  // Handle start command
});

// Callback query handlers
bot.callbackQuery('button_click', async (ctx: GrammyContext) => {
  // Handle button click
});

// Message handlers
bot.on('message:text', async (ctx: GrammyContext) => {
  // Handle text messages
});
```

### Session Management

Sessions stored in Redis:

```typescript
import { session } from '@grammyjs/storage-redis';

bot.use(session({
  initial: () => ({}),
  storage: redisStorage,
}));
```

### Keyboards

Interactive keyboards for better UX:

```typescript
const menuKeyboard = new InlineKeyboard()
  .text('Projects', 'projects')
  .text('Tasks', 'tasks')
  .row()
  .text('Settings', 'settings');

await ctx.reply('Choose an option:', {
  reply_markup: menuKeyboard,
});
```

## Frontend Architecture

### Next.js App Router

Using the new App Router structure:

```
app/
├── (auth)/              # Authentication routes
├── dashboard/           # Protected dashboard
│   ├── projects/        # Project management
│   ├── analytics/       # Analytics page
│   ├── workers/         # Worker management
│   └── settings/        # Settings page
├── api/                 # API routes
└── globals.css          # Global styles
```

### State Management

- **Server State** - React Query (TanStack Query)
- **Client State** - React Context & useState
- **Form State** - React Hook Form

### UI Components

Using a custom UI library:

```typescript
import { Button, Card, Input } from '@labelmint/ui';

export default function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter text" />
      <Button variant="primary">Submit</Button>
    </Card>
  );
}
```

## Testing

### Unit Tests

Using Jest for unit tests:

```typescript
// Example test
import { TaskAssignmentService } from '../services/taskAssignment';

describe('TaskAssignmentService', () => {
  it('should assign task to eligible worker', async () => {
    const service = new TaskAssignmentService(prisma, redis);
    const task = await service.getNextTask({ userId: 'worker1' });
    expect(task).toBeDefined();
  });
});
```

### Integration Tests

Using Supertest for API tests:

```typescript
import request from 'supertest';
import app from '../app';

describe('API', () => {
  it('should create project', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer token')
      .send({
        title: 'Test Project',
        type: 'IMG_CLS',
      });
    expect(response.status).toBe(201);
  });
});
```

### E2E Tests

Using Playwright for end-to-end tests:

```typescript
import { test, expect } from '@playwright/test';

test('user can create project', async ({ page }) => {
  await page.goto('/dashboard/projects/create');
  await page.fill('[data-testid="title"]', 'Test Project');
  await page.click('[data-testid="submit"]');
  await expect(page.locator('h1')).toContainText('Test Project');
});
```

## Deployment

### Docker Configuration

Multi-stage Docker builds for optimization:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### CI/CD Pipeline

GitHub Actions for CI/CD:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          ssh user@server './deploy.sh'
```

## Best Practices

### Code Organization

- Keep services small and focused
- Use dependency injection
- Implement proper error handling
- Write meaningful tests

### Security

- Validate all inputs
- Use parameterized queries
- Implement rate limiting
- Secure sensitive data

### Performance

- Use database indexes
- Implement caching
- Optimize queries
- Use CDN for assets

### Monitoring

- Structured logging
- Error tracking
- Performance metrics
- Health checks

## Debugging

### Common Issues

1. **Database Connection**
   - Check DATABASE_URL format
   - Verify PostgreSQL is running
   - Check network connectivity

2. **Redis Connection**
   - Verify Redis is running
   - Check REDIS_URL format
   - Test with redis-cli

3. **Bot Not Responding**
   - Verify bot token
   - Check bot is running
   - Review bot logs

4. **WebSocket Issues**
   - Check CORS settings
   - Verify Socket.IO configuration
   - Test connection manually

### Debug Tools

- **Prisma Studio** - Database viewer
- **Redis Commander** - Redis GUI
- **Docker Logs** - Container logs
- **NGINX Logs** - Web server logs

## Contributing

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with proper tests
3. Update documentation
4. Run full test suite
5. Submit PR with description

### Code Review Guidelines

- Check for test coverage
- Verify code follows style guide
- Ensure proper error handling
- Check for security issues
- Verify performance impact

### Release Process

1. Update version numbers
2. Update CHANGELOG.md
3. Create git tag
4. Deploy to staging
5. Run smoke tests
6. Deploy to production
7. Monitor for issues