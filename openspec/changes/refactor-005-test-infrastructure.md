---
# OpenSpec Change: Comprehensive Test Infrastructure

## ID
refactor-005-test-infrastructure

## Type
refactor

## Status
proposed

## Priority
high

## Description
Establish proper test infrastructure with centralized configuration, coverage reporting, and automated testing for all components.

## Context
Current testing analysis reveals critical gaps:
- **Overall coverage**: 7.5% (7 test files / 93 implementation files)
- **Frontend coverage**: 0%
- **Bot coverage**: 0%
- **Contract coverage**: 0%
- **No centralized test configuration**
- **No coverage reporting or thresholds**

## Current Testing Issues

### Missing Test Configuration
- No `jest.config.js` or `vitest.config.ts`
- No coverage configuration (nyc, c8)
- Package.json lacks test scripts in main project
- No test data factories or fixtures

### Critical Missing Test Areas
1. **Frontend Components**: No React Testing Library setup
2. **Telegram Bot**: No unit tests for command handlers or conversations
3. **Smart Contracts**: No test suite for contract deployment/interaction
4. **Payment System**: Only basic tests, missing edge cases
5. **Consensus Logic**: Critical business logic untested
6. **Error Scenarios**: Limited error handling tests

## Implementation Plan

### Phase 1: Test Infrastructure Setup

**1.1 Centralized Test Configuration**
```json
// package.json (root)
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:contracts": "hardhat test",
    "test:bot": "vitest run --config vitest.bot.config.ts",
    "test:backend": "vitest run --config vitest.backend.config.ts",
    "test:frontend": "vitest run --config vitest.frontend.config.ts"
  }
}
```

**1.2 Vitest Configuration**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
})
```

### Phase 2: Testing Framework Setup

**2.1 Backend Testing (Vitest + Supertest)**
```typescript
// test/backend/setup.ts
import { beforeAll, afterAll } from 'vitest'
import { createTestApp } from './helpers/test-app'

export const testApp = await createTestApp()

beforeAll(async () => {
  await testApp.setupDatabase()
})

afterAll(async () => {
  await testApp.cleanup()
})
```

**2.2 Frontend Testing (Vitest + React Testing Library)**
```typescript
// test/frontend/setup.ts
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock Telegram Web App SDK
vi.mock('@telegram-apps/sdk', () => ({
  Telegram: {
    WebApp: {
      ready: vi.fn(),
      expand: vi.fn()
    }
  }
}))
```

**2.3 Bot Testing (Vitest + Grammy Mocks)**
```typescript
// test/bot/mocks/bot.mock.ts
export const createMockBot = () => ({
  api: {
    sendMessage: vi.fn(),
    editMessageText: vi.fn(),
    answerCallbackQuery: vi.fn()
  },
  context: {
    reply: vi.fn(),
    editMessageText: vi.fn()
  }
})
```

### Phase 3: Test Factories and Fixtures

**3.1 Database Test Factory**
```typescript
// test/factories/user.factory.ts
export const UserFactory = {
  create: (overrides = {}) => ({
    id: faker.datatype.number(),
    telegram_id: faker.datatype.number(),
    username: faker.internet.userName(),
    email: faker.internet.email(),
    balance: faker.datatype.number({ min: 0, max: 1000 }),
    trust_score: faker.datatype.float({ min: 0, max: 1 }),
    ...overrides
  }),

  createMany: (count: number, overrides = {}) =>
    Array.from({ length: count }, () => UserFactory.create(overrides))
}
```

**3.2 Task Test Factory**
```typescript
// test/factories/task.factory.ts
export const TaskFactory = {
  create: (overrides = {}) => ({
    id: faker.datatype.number(),
    project_id: faker.datatype.number(),
    type: TaskType.IMAGE_CLASSIFICATION,
    data: { image_url: faker.image.imageUrl() },
    status: TaskState.CREATED,
    required_labels: 3,
    ...overrides
  })
}
```

### Phase 4: Critical Path Testing

**4.1 Consensus Logic Tests**
```typescript
// test/unit/consensus.test.ts
describe('Consensus Logic', () => {
  it('should reach consensus with 2/3 agreement', async () => {
    const labels = [
      { worker_id: 1, label: 'cat' },
      { worker_id: 2, label: 'cat' },
      { worker_id: 3, label: 'dog' }
    ]

    const result = await consensusService.checkConsensus(labels)

    expect(result.reached).toBe(true)
    expect(result.agreedLabel).toBe('cat')
    expect(result.confidence).toBe(0.67)
  })
})
```

**4.2 Payment System Tests**
```typescript
// test/unit/payments.test.ts
describe('Payment System', () => {
  it('should process TON payment correctly', async () => {
    const payment = await paymentService.processPayment({
      amount: 100,
      type: 'TON_DEPOSIT',
      wallet_address: 'EQD...'
    })

    expect(payment.status).toBe('completed')
    expect(mockTonWallet.transfer).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100 })
    )
  })

  it('should handle insufficient balance', async () => {
    await expect(
      paymentService.withdraw(1000, testUser.wallet_address)
    ).rejects.toThrow('Insufficient balance')
  })
})
```

**4.3 Bot Flow Tests**
```typescript
// test/integration/bot-flows.test.ts
describe('Bot User Flows', () => {
  it('should complete full task workflow', async () => {
    const bot = createMockBot()
    const user = await UserFactory.create()

    // Start task
    await startTaskCommand(bot.context, user)
    expect(bot.context.reply).toHaveBeenCalledWith(
      expect.stringContaining('Task assigned')
    )

    // Submit label
    await submitLabelHandler(bot.context, 'test_label')
    expect(bot.api.editMessageText).toHaveBeenCalled()

    // Verify task updated
    const task = await TaskService.findById(mockTask.id)
    expect(task.status).toBe(TaskState.PENDING_REVIEW)
  })
})
```

### Phase 5: E2E Testing (Playwright)

**5.1 Mini App E2E Tests**
```typescript
// test/e2e/mini-app.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Mini App Task Flow', () => {
  test('should complete image classification task', async ({ page }) => {
    await page.goto('/mini-app')

    // Mock Telegram Web App
    await page.evaluate(() => {
      window.Telegram = {
        WebApp: {
          ready: () => {},
          initData: { user: { id: 123 } }
        }
      }
    })

    // Start task
    await page.click('[data-testid="start-task"]')
    await expect(page.locator('[data-testid="task-image"]')).toBeVisible()

    // Submit label
    await page.click('[data-testid="label-cat"]')
    await page.click('[data-testid="submit-label"]')
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })
})
```

**5.2 Contract Testing**
```typescript
// test/contracts/PaymentProcessor.test.ts
import { expect } from 'chai'
import { ethers } from 'hardhat'

describe('PaymentProcessor', () => {
  let contract: PaymentProcessor

  beforeEach(async () => {
    const PaymentProcessor = await ethers.getContractFactory('PaymentProcessor')
    contract = await PaymentProcessor.deploy()
  })

  it('should deposit USDT correctly', async () => {
    const amount = ethers.utils.parseUnits('100', 6) // 6 decimals for USDT

    await expect(contract.deposit(amount, user.address))
      .to.emit(contract, 'Deposit')
      .withArgs(user.address, amount)
  })
})
```

### Phase 6: CI/CD Integration

**6.1 GitHub Actions Update**
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm test:coverage

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: microsoft/playwright-github-action@v1
      - run: pnpm test:e2e
```

## Impact
- **Improves**: Code quality, reliability, developer confidence
- **Reduces**: Bugs, regressions, manual testing time
- **Enables**: Safe refactoring, faster deployments
- **Risk**: Low - additive changes only
- **Effort**: 32-40 hours

## Test Strategy
- Write tests for all new features
- Gradually increase coverage requirements
- Use test-driven development for refactors
- Monitor coverage metrics in CI/CD

## Dependencies
- refactor-001-syntax-errors

## Rollout Plan
1. Set up test infrastructure
2. Add tests for critical business logic
3. Implement e2e tests for user flows
4. Set up coverage reporting
5. Gradually increase coverage thresholds

## Success Criteria
- Global test coverage > 80%
- All critical paths tested
- Coverage < 80% blocks merges
- E2E tests pass in CI/CD
- Test suite runs < 5 minutes

## Files to Create
- `/vitest.config.ts` (root)
- `/vitest.backend.config.ts`
- `/vitest.frontend.config.ts`
- `/vitest.bot.config.ts`
- `/test/factories/` (directory)
- `/test/unit/` (directory)
- `/test/integration/` (directory)
- `/test/e2e/` (directory)

## Metrics
- Test coverage: 7.5% → 80%+
- Test count: 7 → 100+
- Build time with tests: < 5 minutes
- Bug detection rate: > 90%

## Notes
Good tests will enable safe and rapid refactoring. Start with critical paths like consensus logic and payments, then expand to full coverage.