# LabelMint Testing Guide

## Overview

This guide covers the comprehensive testing infrastructure for LabelMint, including unit tests, integration tests, E2E tests, load testing, security testing, and visual regression testing.

## Table of Contents

1. [Testing Architecture](#testing-architecture)
2. [Running Tests](#running-tests)
3. [Test Structure](#test-structure)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Load Testing](#load-testing)
8. [Security Testing](#security-testing)
9. [Visual Regression Testing](#visual-regression-testing)
10. [Mock Services](#mock-services)
11. [Test Data Management](#test-data-management)
12. [Coverage Reports](#coverage-reports)
13. [CI/CD Integration](#cicd-integration)

## Testing Architecture

```
LabelMint Testing Architecture
├── Unit Tests (Jest/Vitest)
│   ├── Consensus Algorithms
│   ├── Payment Processing
│   ├── Task Management
│   └── Business Logic
├── Integration Tests
│   ├── API Endpoints
│   ├── Database Operations
│   ├── External Services
│   └── Service Communication
├── E2E Tests (Playwright)
│   ├── User Journeys
│   ├── Cross-browser Testing
│   ├── Mobile Testing
│   └── Telegram Integration
├── Performance Tests (K6)
│   ├── Load Testing
│   ├── Stress Testing
│   ├── Spike Testing
│   └── Soak Testing
├── Security Tests
│   ├── Authentication
│   ├── Authorization
│   ├── Input Validation
│   └── API Security
└── Visual Tests
    ├── Regression Testing
    ├── Responsive Design
    └── UI Consistency
```

## Running Tests

### Quick Start

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run specific test types
pnpm test:unit          # Unit tests only
pnpm test:integration   # Integration tests only
pnpm test:e2e         # E2E tests only
pnpm test:security     # Security tests only
pnpm test:load         # Load tests
```

### Individual Package Testing

```bash
# Test specific package
pnpm --filter @labelmint/shared test
pnpm --filter @labelmint/labeling-backend test
pnpm --filter @labelmint/web test

# Run tests with coverage
pnpm test:coverage

# Watch mode for development
pnpm test:watch
```

### Test Environment Setup

```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d

# Run database migrations
pnpm db:migrate:test

# Seed test data
pnpm db:seed:test
```

## Test Structure

```
test/
├── setup.ts                     # Global test setup
├── fixtures/                    # Test data factories
│   └── factories.ts
├── mocks/                       # External service mocks
│   ├── telegram.mock.ts
│   ├── ton.mock.ts
│   └── aws.mock.ts
├── utils/                       # Test utilities
│   └── helpers.ts
├── unit/                        # Unit tests
├── integration/                 # Integration tests
├── e2e/                        # E2E tests
│   ├── pages/                  # Page objects
│   └── user-journeys/         # User flows
├── load/                        # Load test scripts
├── security/                    # Security tests
└── visual/                      # Visual regression tests
```

## Unit Testing

### Writing Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateConsensus } from '../../../src/consensus';
import { createTestLabel, createTestTask } from '../../fixtures/factories';

describe('Consensus Algorithm', () => {
  let testTask: any;

  beforeEach(async () => {
    testTask = await createTestTask(1);
  });

  it('should achieve consensus with majority agreement', async () => {
    await createTestLabel(testTask.id, 1, { labels: ['cat', 'dog'] });
    await createTestLabel(testTask.id, 2, { labels: ['cat', 'dog'] });
    await createTestLabel(testTask.id, 3, { labels: ['cat', 'dog'] });

    const labels = await getLabelsForTask(testTask.id);
    const consensus = calculateConsensus(labels, 0.7);

    expect(consensus).toEqual(['cat', 'dog']);
  });
});
```

### Best Practices

1. **Use descriptive test names**
   ```typescript
   it('should reject withdrawal when balance is insufficient')
   it('should calculate correct consensus ratio with odd number of workers')
   ```

2. **Test business logic, not implementation details**
   ```typescript
   // Bad
   expect(calculator.internalState).toBe(5)

   // Good
   expect(calculator.add(2, 3)).toBe(5)
   ```

3. **Use factories for test data**
   ```typescript
   const user = await createTestUser({ role: 'WORKER' });
   const project = await createTestProject(user.id);
   ```

4. **Mock external dependencies**
   ```typescript
   vi.mock('@ton/ton', () => ({
     TonClient: {
       mainnet: vi.fn(() => ({
         sendTransaction: vi.fn()
       }))
     }
   }));
   ```

## Integration Testing

### API Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { createTestUser, createTestTask } from '../../fixtures/factories';

describe('Task API Integration', () => {
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    testUser = await createTestUser({ role: 'WORKER' });
    authToken = generateToken(testUser.id);
  });

  it('should assign task to worker', async () => {
    const task = await createTestTask(1);

    const response = await request(app)
      .post(`/api/tasks/${task.id}/assign`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.task.status).toBe('IN_PROGRESS');
  });
});
```

### Database Integration

```typescript
import { testDb } from '../setup';

describe('Database Operations', () => {
  it('should create and retrieve user with wallet', async () => {
    const user = await testDb.user.create({
      data: {
        telegramId: 123456,
        telegramUsername: 'testuser',
        role: 'WORKER'
      }
    });

    const wallet = await testDb.wallet.create({
      data: {
        userId: user.id,
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        currency: 'TON',
        balance: 100.5
      }
    });

    const retrieved = await testDb.user.findUnique({
      where: { id: user.id },
      include: { wallets: true }
    });

    expect(retrieved.wallets).toHaveLength(1);
    expect(retrieved.wallets[0].balance).toBe(100.5);
  });
});
```

## End-to-End Testing

### User Journey Tests

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { DashboardPage } from '../pages/dashboard-page';

test('worker should complete task successfully', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);

  // Login
  await loginPage.goto();
  await loginPage.loginWithTelegram();
  await expect(page).toHaveURL('/dashboard');

  // View available tasks
  await dashboardPage.viewAvailableTasks();
  await expect(page.locator('[data-testid="task-list"]')).toBeVisible();

  // Assign first task
  await page.click('[data-testid="assign-task-button"]:first-child');
  await expect(page.locator('[data-testid="task-workspace"]')).toBeVisible();

  // Complete task
  await page.fill('[data-testid="label-input"]', 'cat');
  await page.click('[data-testid="submit-task"]');
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

### Cross-Browser Testing

Playwright automatically tests across multiple browsers defined in `playwright.config.ts`:

```typescript
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } }
  ]
});
```

### Running E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific tests
pnpm test:e2e --grep "Client creates project"

# Run on specific browser
pnpm test:e2e --project=chromium

# Run with UI
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e --debug
```

## Load Testing

### K6 Load Test Script

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '5m', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1']
  }
};

export default function () {
  const response = http.get('http://localhost:3001/api/tasks');
  check(response, {
    'status is 200': r => r.status === 200,
    'response time < 500ms': r => r.timings.duration < 500
  });
  sleep(1);
}
```

### Running Load Tests

```bash
# Run load test
k6 run tests/load/task-assignment.js

# Run with environment variables
k6 run -e BASE_URL=https://api.labelmint.org tests/load/task-assignment.js

# Run with custom options
k6 run --vus 1000 --duration 30s tests/load/stress-test.js

# Generate HTML report
k6 run --out html=report.html tests/load/api-load.js
```

## Security Testing

### Authentication Tests

```typescript
describe('Authentication Security', () => {
  it('should prevent brute force attacks', async () => {
    const promises = Array(100).fill(null).map(() =>
      request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' })
    );

    const responses = await Promise.all(promises);
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(50);
  });

  it('should validate JWT tokens properly', async () => {
    const invalidToken = 'invalid.jwt.token';
    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${invalidToken}`)
      .expect(401);

    expect(response.body.error).toContain('invalid token');
  });
});
```

### Input Validation Tests

```typescript
describe('Input Validation', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    const response = await request(app)
      .post('/api/data')
      .send({ query: maliciousInput })
      .expect(400);

    expect(response.body.error).toContain('invalid input');
  });

  it('should sanitize XSS attempts', async () => {
    const xssPayload = '<script>alert("XSS")</script>';

    const response = await request(app)
      .post('/api/comments')
      .send({ text: xssPayload })
      .expect(200);

    // Script should be escaped
    expect(response.body.data.text).not.toContain('<script>');
  });
});
```

## Visual Regression Testing

### Percy Integration

```typescript
import { test, expect } from '@playwright/test';
import { percySnapshot } from '@percy/playwright';

test('task creation form visual consistency', async ({ page }) => {
  await page.goto('/projects/create');

  // Take snapshots at different states
  await percySnapshot(page, 'Project Creation - Empty');

  await page.fill('[data-testid="project-name"]', 'Test Project');
  await percySnapshot(page, 'Project Creation - With Name');

  await page.selectOption('[data-testid="project-category"]', 'image_classification');
  await percySnapshot(page, 'Project Creation - Category Selected');
});
```

### Running Visual Tests

```bash
# Run visual tests
pnpm test:visual

# Run with Percy token
PERCY_TOKEN=$PERCY_TOKEN pnpm test:visual
```

## Mock Services

### Telegram Bot Mock

```typescript
// test/mocks/telegram.mock.ts
import { rest } from 'msw';

export const telegramMocks = [
  rest.get('https://api.telegram.org/bot:token/getMe', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          id: 123456789,
          username: 'labelmint_bot',
          first_name: 'LabelMint'
        }
      })
    );
  })
];
```

### TON Blockchain Mock

```typescript
// test/mocks/ton.mock.ts
export const tonMocks = [
  rest.post('https://toncenter.com/api/v2/sendBoc', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          transaction_id: {
            lt: '34088353000003',
            hash: 'test_hash'
          }
        }
      })
    );
  })
];
```

## Test Data Management

### Using Factories

```typescript
import { createTestUser, createTestProject } from '../fixtures/factories';

// Create related test data
const client = await createTestUser({ role: 'CLIENT' });
const project = await createTestProject(client.id, {
  name: 'Test Project',
  budget: 1000
});

// Create bulk data
const { users, projects, tasks } = await createTestDataset({
  numUsers: 100,
  numProjects: 10,
  numTasks: 1000
});
```

### Custom Factories

```typescript
// test/factories/custom.factory.ts
export const createHoneypotTask = async (projectId: number) => {
  return await testDb.task.create({
    data: {
      projectId,
      isHoneypot: true,
      expectedLabels: ['known_answer'],
      reward: 10.0 // Higher reward for honeypots
    }
  });
};
```

## Coverage Reports

### Viewing Coverage

```bash
# Generate coverage report
pnpm test:coverage

# View HTML report
open coverage/index.html

# Check coverage thresholds
pnpm test:coverage --threshold=90
```

### Coverage Configuration

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/migrations/**'
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/consensus/**': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
};
```

## CI/CD Integration

### GitHub Actions

The test suite runs automatically on:

1. **Push** to `main` and `develop` branches
2. **Pull Requests** targeting `main`
3. **Daily schedule** at 2 AM UTC

### Test Matrix

- **Node.js**: 18, 20, 21
- **Browsers**: Chromium, Firefox, WebKit
- **Operating System**: Ubuntu (primary), Windows (on demand)

### Test Results

Results are uploaded to:

- **Codecov**: Coverage reports
- **GitHub Artifacts**: Test reports and screenshots
- **Percy**: Visual regression results
- **Snyk**: Security vulnerability reports

## Best Practices

### General Guidelines

1. **Write clear, descriptive test names**
2. **Test one thing per test**
3. **Use AAA pattern (Arrange, Act, Assert)**
4. **Mock external dependencies**
5. **Use factories for test data**
6. **Clean up after each test**
7. **Write tests before fixing bugs (regression tests)**

### Performance Considerations

1. **Use `test.concurrent()` for independent tests**
2. **Limit database queries in tests**
3. **Reuse test fixtures where possible**
4. **Avoid unnecessary API calls**
5. **Use in-memory databases for unit tests**

### Security Testing

1. **Test authentication boundaries**
2. **Validate all inputs**
3. **Test authorization levels**
4. **Check for information disclosure**
5. **Test rate limiting**

### Debugging Tips

```typescript
// Debug failing tests
it('should do something', () => {
  console.log('Test data:', testData);
  debugger; // Pause execution in Node debugger
  expect(result).toBe(expected);
});

// Debug Playwright tests
test('debug test', async ({ page }) => {
  await page.goto('/');
  await page.pause(); // Pause and open inspector
});
```

## Troubleshooting

### Common Issues

1. **Database connection errors**
   ```bash
   # Check test database is running
   docker-compose -f docker-compose.test.yml ps

   # Reset database
   pnpm db:test:reset
   ```

2. **Port conflicts**
   ```bash
   # Kill processes using ports
   lsof -ti:3001 | xargs kill -9
   lsof -ti:5433 | xargs kill -9
   ```

3. **Playwright browser issues**
   ```bash
   # Reinstall browsers
   pnpm playwright install

   # Install system dependencies
   pnpm playwright install-deps
   ```

4. **Coverage not generating**
   ```bash
   # Clear coverage cache
   rm -rf coverage

   # Run with verbose output
   pnpm test:coverage --verbose
   ```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/)
- [K6 Documentation](https://k6.io/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)

## Contributing

When adding new tests:

1. Follow the existing file structure
2. Use the established patterns and utilities
3. Ensure 90% coverage for new code
4. Add documentation for complex test scenarios
5. Update this guide when adding new test types