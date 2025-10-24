# Testing Framework Guide

This document provides a comprehensive guide for testing in the LabelMint project.

## Table of Contents

- [Overview](#overview)
- [Testing Architecture](#testing-architecture)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Mock Services](#mock-services)
- [Test Utilities](#test-utilities)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

LabelMint uses **Vitest** as its primary testing framework with a unified configuration system that supports multiple test environments:

- **Unit Tests** - Test individual functions and components in isolation
- **Integration Tests** - Test interactions between modules
- **Frontend Tests** - Test React components and user interactions
- **Backend Tests** - Test API endpoints and database operations
- **Bot Tests** - Test Telegram bot functionality
- **E2E Tests** - Test complete user workflows
- **Performance Tests** - Test system performance under load

## Testing Architecture

### Configuration System

The unified testing system uses environment-specific configurations:

```typescript
// vitest.config.ts
export default createTestConfig('unit') // Default
export const frontendConfig = createTestConfig('frontend')
export const backendConfig = createTestConfig('backend')
export const botConfig = createTestConfig('bot')
```

### Directory Structure

```
test/
├── setup/                    # Test setup files
│   ├── unit-setup.ts          # Unit test setup
│   ├── integration-setup.ts    # Integration test setup
│   ├── frontend-setup.ts       # Frontend test setup
│   ├── backend-setup.ts        # Backend test setup
│   ├── bot-setup.ts           # Bot test setup
│   ├── database-setup.ts       # Database setup
│   ├── redis-setup.ts          # Redis mock setup
│   ├── telegram-mock-setup.ts # Telegram API mocks
│   └── msw-setup.ts           # MSW API mocking
├── teardown/                 # Test cleanup files
│   ├── integration-teardown.ts
│   ├── backend-teardown.ts
│   └── database-teardown.ts
├── mocks/                     # Mock services and factories
│   ├── services.ts            # Centralized service mocks
│   └── factories.ts           # Test data factories
├── utils/                     # Test utility functions
│   ├── factories.ts           # Test data creation
│   └── test-helpers.ts       # Common helper functions
├── fixtures/                  # Test data and fixtures
│   └── index.ts              # Common test datasets
├── unit/                      # Unit tests
│   ├── consensus/            # Consensus algorithm tests
│   ├── validation/           # Validation logic tests
│   ├── backend/              # Backend unit tests
│   ├── bot/                  # Bot unit tests
│   ├── frontend/             # Frontend unit tests
│   └── payment/              # Payment system tests
├── integration/               # Integration tests
│   ├── api/                  # API integration tests
│   ├── payment-system.test.ts
│   └── user-workflow.test.ts
├── e2e/                      # End-to-end tests
│   ├── api/                  # API e2e tests
│   └── frontend/             # Frontend e2e tests
├── performance/               # Performance tests
│   └── load.test.ts
├── security/                 # Security tests
│   └── input-validation.test.ts
└── visual/                   # Visual regression tests
```

## Test Types

### Unit Tests

Test individual functions and components in isolation:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateConsensus } from '@shared/consensus'

describe('Consensus Algorithm', () => {
  it('should calculate consensus with majority agreement', () => {
    const labels = ['cat', 'cat', 'dog']
    const result = calculateConsensus(labels, 0.7)

    expect(result).toBe('cat')
  })
})
```

### Integration Tests

Test interactions between modules:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestTask, createTestLabel } from '@test/utils/factories'
import { testDb } from '@test/setup/database-setup'

describe('Task Processing Integration', () => {
  beforeEach(async () => {
    await testDb.label.deleteMany()
    await testDb.task.deleteMany()
  })

  it('should process task from assignment to completion', async () => {
    const task = await createTestTask('1')
    const label = await createTestLabel(task.id, 1)

    // Test integration logic
    expect(label.taskId).toBe(task.id)
  })
})
```

### Frontend Tests

Test React components and user interactions:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskCard } from '@frontend/components/TaskCard'
import { createTestTask } from '@test/utils/factories'

describe('TaskCard Component', () => {
  it('should render task information correctly', () => {
    const task = createTestTask('1')
    render(<TaskCard task={task} />)

    expect(screen.getByText(task.instructions)).toBeInTheDocument()
  })
})
```

## Running Tests

### Basic Commands

```bash
# Run all tests
pnpm test

# Run specific test types
pnpm test:unit          # Unit tests only
pnpm test:integration    # Integration tests only
pnpm test:frontend      # Frontend tests only
pnpm test:backend       # Backend tests only
pnpm test:bot           # Bot tests only
pnpm test:e2e           # E2E tests only
pnpm test:performance   # Performance tests only

# Watch mode for development
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui
```

### CI/CD Testing

```bash
# Run all tests with coverage for CI
pnpm test:ci

# Run specific test suites for CI
pnpm test:unit:ci
pnpm test:integration:ci
pnpm test:e2e:ci
```

## Writing Tests

### Test Structure

Follow this standard structure:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Feature Being Tested', () => {
  beforeEach(() => {
    // Setup before each test
  })

  afterEach(() => {
    // Cleanup after each test
  })

  describe('Specific Functionality', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test input'

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toBe('expected output')
    })
  })
})
```

### Using Test Utilities

Access global test utilities in any test:

```typescript
// Create mock data
const user = global.testUtils.createMockUser()
const task = global.testUtils.createMockTask('1')

// Use helper functions
global.testUtils.expectValidEmail(user.email)
global.testUtils.expectValidPhone(user.phoneNumber)

// Generate random data
const randomString = global.testUtils.generateRandomString(10)
const randomEmail = global.testUtils.generateRandomEmail()
```

### Async Testing

Handle asynchronous operations:

```typescript
it('should handle async operations', async () => {
  const promise = Promise.resolve('async result')
  const result = await promise

  expect(result).toBe('async result')
})

it('should handle async errors', async () => {
  await expect(Promise.reject('error')).rejects.toThrow('error')
})
```

## Mock Services

### Centralized Mocks

Use the centralized mock services:

```typescript
import { mockServices } from '@test/mocks/services'

// Reset all mocks before test
beforeEach(() => {
  mockServices.resetAll()
})

it('should use mocked auth service', () => {
  mockServices.auth.generateToken.mockReturnValue('mock-token')

  const token = authService.generateToken('user123')

  expect(token).toBe('mock-token')
  expect(mockServices.auth.generateToken).toHaveBeenCalledWith('user123')
})
```

### Service Mock Examples

```typescript
// Mock payment service
const paymentService = mockServices.payment
paymentService.createPayment.mockResolvedValue({
  id: 'payment_123',
  amount: 100,
  status: 'pending'
})

// Mock TON service
const tonService = mockServices.ton
tonService.getBalance.mockResolvedValue({
  tonBalance: '5.5',
  usdtBalance: '1000'
})
```

## Test Utilities

### Factories

Create test data using factories:

```typescript
import { createTestTask, createTestUser, createMockTelegramUpdate } from '@test/mocks/factories'

// Create mock task
const task = createTestTask('1', {
  type: 'image_classification',
  difficulty: 'hard'
})

// Create mock user
const user = createTestUser({
  role: 'admin',
  accuracy: 0.95
})

// Create mock Telegram update
const update = createMockTelegramUpdate({
  message: { text: '/start' }
})
```

### Helper Functions

Use utility functions for common operations:

```typescript
import {
  calculateConsensus,
  validateEmail,
  sanitizeHTML,
  sleep
} from '@test/utils/test-helpers'

// Validate email
expect(validateEmail('test@example.com')).toBe(true)

// Sanitize HTML
expect(sanitizeHTML('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')

// Wait for async operations
await sleep(1000) // Wait 1 second
```

### API Testing Helpers

For API integration tests:

```typescript
import { mockFetch, createMockResponse } from '@test/utils/test-helpers'

// Mock fetch responses
global.fetch = mockFetch({
  success: true,
  data: { id: 1, name: 'Test' }
})

// Test API calls
const response = await fetch('/api/tasks')
const data = await response.json()
expect(data.success).toBe(true)
```

## Best Practices

### 1. Test Organization

- **Describe blocks**: Group related tests in describe blocks
- **Test naming**: Use descriptive names that explain what is being tested
- **Arrange-Act-Assert**: Structure tests clearly with these three phases
- **One assertion per test**: Focus on testing one thing at a time

### 2. Test Data

- **Use factories**: Create test data using factory functions
- **Avoid magic values**: Use descriptive test data
- **Isolate tests**: Ensure tests don't depend on each other

### 3. Mocking

- **Mock external dependencies**: Use mocks for external services
- **Reset mocks**: Reset mocks between tests
- **Use centralized mocks**: Use the provided mock services

### 4. Assertions

- **Be specific**: Use specific matchers for better error messages
- **Test both success and failure**: Test both happy path and error cases
- **Use meaningful assertions**: Assert what matters, not implementation details

### 5. Async Testing

- **Handle promises**: Use async/await for promise-based code
- **Test timeouts**: Set appropriate timeouts for async operations
- **Test error cases**: Test promise rejections and error handling

### 6. Performance Testing

- **Benchmark critical paths**: Measure performance of critical operations
- **Test with realistic data**: Use realistic data sizes
- **Monitor memory**: Check for memory leaks in long-running tests

### 7. Security Testing

- **Input validation**: Test with malicious inputs
- **Authorization**: Test that users can only access authorized resources
- **Data sanitization**: Ensure user inputs are properly sanitized

## Coverage Requirements

### Coverage Thresholds

- **Global**: 80% minimum for all metrics
- **Backend**: 85% minimum for critical business logic
- **Frontend**: 75% minimum for UI components
- **Bot handlers**: 90% minimum for critical bot functionality

### Coverage Reports

Generate coverage reports:

```bash
# Generate coverage report
pnpm test:coverage

# Coverage in different formats
pnpm test:coverage --reporter=text
pnpm test:coverage --reporter=html
pnpm test:coverage --reporter=lcov
```

### Coverage Exclusions

The following are excluded from coverage:

- Test files and test utilities
- Configuration files
- Type definition files
- Migration and seed files
- Mock and fixture files

## Troubleshooting

### Common Issues

#### 1. Test Timeouts

```typescript
// Increase timeout for slow tests
it('should complete within extended time', async () => {
  // Test code that might be slow
}, { timeout: 10000 }) // 10 seconds
```

#### 2. Mock Persistence

```typescript
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks()
  mockServices.resetAll()
})
```

#### 3. Database Connection Issues

```typescript
beforeAll(async () => {
  // Ensure database is connected before tests
  await setupDatabase()
})

afterAll(async () => {
  // Clean up database connection after tests
  await disconnectDatabase()
})
```

#### 4. Test Environment Variables

```typescript
// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/labelmint_test'
```

### Debugging Tests

#### 1. Vitest UI

```bash
# Run tests with UI for debugging
pnpm test:ui
```

#### 2. Console Output

```typescript
it('should output debug information', () => {
  console.log('Debug info:', someVariable)
  // Test logic
})
```

#### 3. VSCode Integration

Install the Vitest extension for VSCode to:
- Run tests from the editor
- Debug tests with breakpoints
- Get inline test results

#### 4. Test Isolation

Ensure tests are properly isolated:

```typescript
beforeEach(() => {
  // Reset global state
  global.testState = {}

  // Clear mocks
  vi.clearAllMocks()

  // Reset localStorage
  localStorage.clear()
})
```

## Continuous Integration

### GitHub Actions

The testing framework integrates with CI/CD pipelines:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - run: pnpm install
      - run: pnpm test:ci
      - uses: codecov/codecov-action@v3
```

### Test Results

Test results are automatically uploaded to:
- **Coverage reports**: Uploaded to Codecov
- **Test artifacts**: Stored as GitHub Actions artifacts
- **Performance metrics**: Tracked in CI dashboards

## Contributing to Tests

### Adding New Tests

1. **Choose the right test type**: Unit, integration, or E2E
2. **Use the standard structure**: Follow the established patterns
3. **Use factories**: Create test data with factory functions
4. **Mock appropriately**: Use centralized mocks for external services
5. **Add coverage**: Ensure new functionality is properly covered

### Updating Mocks

When adding new services:

1. **Add to centralized mocks**: Update `test/mocks/services.ts`
2. **Create factory functions**: Add to `test/mocks/factories.ts`
3. **Document usage**: Update this documentation

### Performance Considerations

- **Parallel execution**: Tests run in parallel by default
- **Database isolation**: Each test runs in a transaction
- **Mock efficiency**: Use efficient mock implementations
- **Test optimization**: Avoid redundant setup and teardown

This testing framework provides a solid foundation for maintaining code quality and reliability across the LabelMint platform.