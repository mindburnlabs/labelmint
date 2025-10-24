# 🧪 Testing Guide for LabelMint

## 🎯 **Test Structure Overview**

```
LabelMint/
├── test/
│   ├── unit/              # Unit tests for isolated logic
│   ├── integration/        # Service integration tests
│   ├── e2e/             # End-to-end user journeys
│   └── mocks/           # Mock services and test utilities
├── vitest.config.ts     # Test configuration
├── playwright.config.ts # E2E test configuration
└── docs/              # Test documentation
```

## 🚀 **Quick Start Commands**

### **Run All Tests**
```bash
# Run all test suites
pnpm test

# Run with coverage report
pnpm test:coverage

# Run specific suites
pnpm test:unit           # Unit tests only
pnpm test:integration    # Integration tests only
pnpm test:e2e             # E2E tests only
pnpm test:consensus       # Consensus logic tests
pnpm test:backend          # Backend service tests
pnpm test:payment          # Payment system tests
pnpm test:bot             # Bot tests
pnpm test:frontend        # Frontend tests
```

### **Run E2E Tests**
```bash
# Run all E2E tests across devices
pnpm test:e2e

# Run specific E2E test
pnpm test:e2e --grep "user login"

# Run E2E tests with UI mode
pnpm test:e2e --ui
```

### **Development Mode**
```bash
# Watch for changes during development
pnpm test:watch

# Run tests with verbose output
pnpm test --reporter=verbose
```

### **CI/CD Pipeline**
```bash
# Run tests in CI environment
pnpm test:ci

# Generate coverage reports
pnpm test:coverage --reporter=json
```

## 🧪 **Test Categories**

### **Unit Tests**
- **Consensus Logic**: State machine validation and consensus calculation
- **String Helpers**: Capitalization, truncation, slug generation
- **Array Helpers**: Chunking, deduplication
- **Date Helpers**: Formatting, relative time
- **Performance Utils**: Debouncing, throttling, memoization
- **Validation Utils**: Email, phone, URL validation
- **Security Validation**: XSS protection, input sanitization

### **Integration Tests**
- **Authentication API**: Login, logout, token validation, social auth
- **Tasks API**: CRUD operations, assignment, completion, search
- **Projects API**: Management, statistics, permissions

### **E2E Tests**
- **User Journey**: Complete workflows from login to task completion
- **Responsive Design**: Mobile and tablet testing
- **Security Testing**: Authorization and access control

### **Mock Services**
- **MockAuthService**: User management, JWT tokens, permissions
- **MockTaskService**: Task and project management
- **MockPaymentService**: Transaction processing and balance tracking

## 🔧 **Mock Service Usage**

```typescript
import { MockAuthService } from '@test/mocks/services'

// In test setup
const authService = MockAuthService.create()
const mockUser = authService.createTestUser({ role: 'worker' })

// In test
const token = await authService.createToken(mockUser.id)
const result = await authService.validateToken(token)
```

## 📊 **Test Configuration**

### **Vitest Configuration**
- **Environment**: Node.js with jsdom DOM
- **Globals**: Enabled for test utilities
- **Timeout**: 10 seconds per test
- **Coverage**: Available with reporters

### **Playwright Configuration**
- **Browsers**: Chrome, Firefox, Safari
- **Devices**: Desktop, Mobile (iPhone, iPad, Pixel)
- **Features**: Video recording, screenshots, tracing
- **Reporting**: HTML, JSON, JUnit, CLI

## 🎯 **Coverage Goals**

- **Unit Tests**: Cover all utility functions and business logic
- **Integration Tests**: Verify service interactions and API contracts
- **E2E Tests**: Validate complete user workflows and responsive design
- **Target**: 90%+ coverage before production deployment

## 🚀 **Best Practices**

1. **Test Isolation**: Each test is independent and doesn't rely on other tests
2. **Mock Strategy**: Use mocks for external dependencies
3. **Clear Assertions**: Use descriptive error messages and expect patterns
4. **Data Generation**: Use faker.js for realistic test data
5. **Cleanup**: Always clean up state in afterEach blocks