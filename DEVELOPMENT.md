# 💻 LabelMint Development Guide

Comprehensive development guide covering workflow, coding standards, best practices, and contribution guidelines for the LabelMint platform.

## Table of Contents

1. [Development Overview](#development-overview)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Coding Standards](#coding-standards)
5. [Development Workflow](#development-workflow)
6. [Testing Strategy](#testing-strategy)
7. [Code Quality](#code-quality)
8. [Git Workflow](#git-workflow)
9. [Pull Request Process](#pull-request-process)
10. [Code Review Guidelines](#code-review-guidelines)
11. [Local Development](#local-development)
12. [Debugging](#debugging)
13. [Performance Guidelines](#performance-guidelines)
14. [Documentation Standards](#documentation-standards)
15. [Tools and IDE Setup](#tools-and-ide-setup)
16. [Troubleshooting](#troubleshooting)

## Development Overview

LabelMint follows modern development practices with a focus on code quality, testing, and maintainability. The development process is designed to be collaborative, efficient, and enjoyable.

### Development Principles

- **Code Quality First**: Clean, maintainable, and well-tested code
- **Test-Driven Development**: Comprehensive testing at all levels
- **Collaborative Workflow**: Team-based development with code reviews
- **Continuous Integration**: Automated testing and deployment
- **Documentation**: Self-documenting code with clear comments
- **Performance**: Optimized code with attention to performance
- **Security**: Security-first mindset in all development

### Technology Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.7+
- **Package Manager**: pnpm 9.15.1+
- **Framework**: Next.js 15+, Express.js
- **Database**: PostgreSQL 15+, Redis 7+
- **Testing**: Vitest, Playwright, Jest
- **Linting**: ESLint 9+, Prettier
- **Build**: Docker, Kubernetes

## Development Setup

### Prerequisites

#### Required Software

```bash
# Install Node.js (using nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm@9.15.1

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git (if not already installed)
sudo apt-get install git  # Ubuntu/Debian
brew install git              # macOS
```

#### VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "streetsidesoftware.code-spell-checker",
    "ms-vscode.vscode-jest",
    "playwright.playwright"
  ]
}
```

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/mindburn-labs/labelmint.git
cd labelmint

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.example .env.development

# 4. Start development environment
pnpm run dev

# 5. Run tests
pnpm test

# 6. Check code quality
pnpm lint
pnpm type-check
```

## Project Structure

### Repository Layout

```
labelmint/
├── apps/                          # Frontend applications
│   ├── web/                      # Main web application
│   │   ├── src/
│   │   │   ├── app/             # Next.js app router
│   │   │   ├── components/      # React components
│   │   │   ├── lib/             # Utilities
│   │   │   ├── hooks/           # Custom hooks
│   │   │   └── types/           # Type definitions
│   │   ├── public/              # Static assets
│   │   ├── tests/               # Component tests
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.js
│   │   └── next.config.js
│   ├── admin/                   # Admin dashboard
│   └── telegram-mini-app/       # Telegram mini-app
├── services/                     # Backend services
│   ├── labeling-backend/         # Core labeling service
│   │   ├── src/
│   │   │   ├── controllers/     # API controllers
│   │   │   ├── services/         # Business logic
│   │   │   ├── models/           # Data models
│   │   │   ├── middleware/       # Express middleware
│   │   │   ├── utils/            # Utilities
│   │   │   ├── types/            # Type definitions
│   │   │   └── config/           # Configuration
│   │   ├── tests/               # Tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── payment-backend/          # Payment processing service
├── packages/                     # Shared packages
│   ├── shared/                   # Shared utilities and types
│   ├── ui/                       # UI components
│   └── clients/                  # API clients
├── config/                       # Configuration files
├── docs/                         # Documentation
├── infrastructure/               # Infrastructure as code
├── scripts/                      # Utility scripts
├── test/                         # Global test configuration
├── .github/                      # GitHub configuration
├── package.json                  # Root package.json
├── pnpm-workspace.yaml          # Workspace configuration
├── tsconfig.base.json           # Base TypeScript config
├── eslint.config.js              # ESLint configuration
├── prettier.config.js            # Prettier configuration
├── vitest.config.ts              # Vitest configuration
└── README.md                     # Project documentation
```

### Module Organization

```typescript
// Example service structure
// src/services/task-assignment/
├── index.ts                 # Public API
├── task-assignment.service.ts  # Main service logic
├── types.ts                 # Type definitions
├── utils.ts                 # Helper functions
├── errors.ts                # Custom errors
├── validators.ts            # Input validation
├── factories.ts             # Test factories
└── __tests__/               # Tests
    ├── task-assignment.service.test.ts
    ├── utils.test.ts
    └── fixtures/
```

## Coding Standards

### TypeScript Standards

#### Type Definitions

```typescript
// Use interfaces for object shapes
interface User {
  id: string;
  telegramId: bigint;
  email?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Use enums for fixed sets of values
enum UserRole {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
  WORKER = 'WORKER',
  VIEWER = 'VIEWER'
}

// Use union types for multiple possibilities
type TaskStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// Use generics for reusable components
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Use branded types for special values
type TaskId = string & { readonly __brand: unique symbol };
type UserId = string & { readonly __brand: unique symbol };

// Helper to create branded types
function createTaskId(id: string): TaskId {
  return id as TaskId;
}
```

#### Function Definitions

```typescript
// Use arrow functions for most cases
const calculateConsensus = (answers: TaskAnswer[]): ConsensusResult => {
  // Implementation
};

// Use descriptive parameter names
const assignTaskToWorker = async (
  workerId: UserId,
  taskPreferences: TaskPreferences,
  options: AssignmentOptions = {}
): Promise<Task | null> => {
  // Implementation
};

// Use JSDoc comments for public APIs
/**
 * Assigns a task to a worker based on their preferences and performance
 * @param workerId - The worker's unique identifier
 * @param taskPreferences - Worker's task preferences
 * @param options - Additional assignment options
 * @returns The assigned task or null if no suitable task found
 */
async function assignTask(
  workerId: UserId,
  taskPreferences: TaskPreferences,
  options: AssignmentOptions = {}
): Promise<Task | null> {
  // Implementation
}

// Return types should be explicitly defined
interface UserService {
  getUser(id: UserId): Promise<User | null>;
  createUser(userData: CreateUserData): Promise<User>;
  updateUser(id: UserId, updates: UpdateUserData): Promise<User>;
  deleteUser(id: UserId): Promise<void>;
}
```

### Code Style

#### Naming Conventions

```typescript
// Variables and functions: camelCase
const taskAssignmentService = new TaskAssignmentService();
const currentUserId = 'user-123';

// Classes and interfaces: PascalCase
class TaskAssignmentService {}
interface UserPreferences {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 20;

// Files: kebab-case
// task-assignment.service.ts
// user-preferences.ts

// Private members: underscore prefix
class DatabaseService {
  private _pool: Pool;

  private async _executeQuery(query: string, params: any[]) {
    // Implementation
  }
}

// Types and interfaces: PascalCase
type TaskResult = {
  id: string;
  status: TaskStatus;
  score: number;
};

// Enums: PascalCase
enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}
```

#### Error Handling

```typescript
// Use custom error classes
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

// Use Result type for operations that can fail
type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};

// Helper functions for Result type
const ok = <T>(data: T): Result<T> => ({ success: true, data });
const err = <E>(error: E): Result<never, E> => ({ success: false, error });

// Usage
const assignTask = async (workerId: string): Promise<Result<Task>> => {
  try {
    const task = await findAvailableTask(workerId);
    if (!task) {
      return err(new NotFoundError('Task', workerId));
    }
    return ok(task);
  } catch (error) {
    return err(error as Error);
  }
};
```

#### Async/Await Patterns

```typescript
// Use async/await consistently
async function processTaskSubmission(
  taskId: string,
  workerId: string,
  answer: TaskAnswer
): Promise<TaskSubmission> {
  // Validate inputs
  const validation = await validateTaskAnswer(answer);
  if (!validation.isValid) {
    throw new ValidationError('Invalid task answer', validation.field);
  }

  // Process submission
  const submission = await createTaskSubmission({
    taskId,
    workerId,
    answer,
    timestamp: new Date()
  });

  // Update task status
  await updateTaskStatus(taskId, 'SUBMITTED');

  // Trigger payment calculation
  await calculatePayment(submission.id);

  return submission;
}

// Handle multiple concurrent operations
async function processMultipleTasks(
  tasks: Task[]
): Promise<TaskSubmission[]> {
  // Process in parallel with controlled concurrency
  const results = await Promise.allSettled(
    tasks.map(task => processTaskSubmission(task.id, task.workerId, task.answer))
  );

  // Filter successful submissions
  return results
    .filter((result): result is PromiseFulfilledResult<TaskSubmission> =>
      result.status === 'fulfilled'
    )
    .map(result => result.value);
}

// Use proper error boundaries
class TaskProcessor {
  async processWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }

    throw lastError!;
  }
}
```

## Development Workflow

### Daily Development Workflow

```bash
# 1. Start the day - update main branch
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/task-assignment-improvements

# 3. Start development environment
pnpm run dev

# 4. Work on feature (make small, testable changes)

# 5. Run tests frequently
pnpm test --watch

# 6. Check code quality
pnpm lint
pnpm type-check

# 7. Commit changes
git add .
git commit -m "feat: improve task assignment algorithm"

# 8. Push and create PR
git push origin feature/task-assignment-improvements
```

### Branch Strategy

```bash
# Main branches
main                    # Production-ready code
develop                 # Integration branch
feature/task-name       # Feature branches
hotfix/issue-description  # Hotfix branches
release/v1.2.0          # Release branches

# Branch naming conventions
feature/user-authentication
feature/payment-processing
feature/task-management
hotfix/critical-bug-fix
release/v1.2.0
```

### Commit Message Guidelines

```bash
# Format: <type>(<scope>): <description>

# Types:
feat:     New feature
fix:      Bug fix
docs:     Documentation changes
style:    Code formatting (no logic change)
refactor: Code refactoring
test:     Adding or updating tests
chore:    Maintenance tasks, dependency updates
perf:     Performance improvements
ci:       CI/CD changes
build:    Build system changes

# Examples:
feat(auth): add JWT authentication
fix(payment): resolve withdrawal timeout issue
docs(readme): update installation instructions
refactor(task): simplify consensus algorithm
test(unit): add payment service tests
chore(deps): update dependencies
perf(database): add query optimization
ci(github): add automated testing workflow
```

## Testing Strategy

### Test Pyramid

```
    E2E Tests (10%)
   ┌─────────────────┐
   │  User Journeys  │
   │  Integration   │
   └─────────────────┘
         ▲
    Integration Tests (20%)
   ┌─────────────────┐
   │  API Endpoints │
   │  Database Ops   │
   │  Service Comms │
   └─────────────────┘
         ▲
    Unit Tests (70%)
   ┌─────────────────┐
   │  Functions      │
   │  Components     │
   │  Utilities      │
   └─────────────────┘
```

### Unit Testing

```typescript
// Example: Task Assignment Service Test
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskAssignmentService } from '../task-assignment.service';
import { createTestTask, createTestUser } from '../../test/factories';

describe('TaskAssignmentService', () => {
  let service: TaskAssignmentService;

  beforeEach(() => {
    service = new TaskAssignmentService();
    vi.clearAllMocks();
  });

  describe('assignTask', () => {
    it('should assign task to eligible worker', async () => {
      // Arrange
      const worker = createTestUser({
        role: 'WORKER',
        accuracy: 0.9,
        completedTasks: 100
      });
      const task = createTestTask({
        type: 'IMAGE_CLASSIFICATION',
        difficulty: 'EASY',
        requiredAccuracy: 0.8
      });

      // Mock dependencies
      vi.spyOn(service, 'isWorkerEligible').mockResolvedValue(true);
      vi.spyOn(service, 'reserveTask').mockResolvedValue(true);

      // Act
      const result = await service.assignTask(worker.id, task.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.workerId).toBe(worker.id);
      expect(service.isWorkerEligible).toHaveBeenCalledWith(worker, task);
      expect(service.reserveTask).toHaveBeenCalledWith(task.id, worker.id);
    });

    it('should throw error for ineligible worker', async () => {
      // Arrange
      const worker = createTestUser({ accuracy: 0.5 });
      const task = createTestTask({ requiredAccuracy: 0.8 });

      vi.spyOn(service, 'isWorkerEligible').mockResolvedValue(false);

      // Act & Assert
      await expect(service.assignTask(worker.id, task.id))
        .rejects.toThrow('Worker not eligible for this task');
    });
  });

  describe('calculateWorkerScore', () => {
    it('should calculate score based on accuracy and experience', () => {
      const worker = createTestUser({
        accuracy: 0.9,
        completedTasks: 100,
        level: 'SILVER'
      });

      const score = service.calculateWorkerScore(worker);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
```

### Integration Testing

```typescript
// Example: API Integration Test
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { createTestUser, createTestProject } from '../../test/factories';

describe('Tasks API', () => {
  let authToken: string;
  let testUser: any;
  let testProject: any;

  beforeAll(async () => {
    // Set up test data
    testUser = await createTestUser({ role: 'WORKER' });
    testProject = await createTestProject(testUser.id);

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        telegramId: testUser.telegramId
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe('GET /api/tasks/next', () => {
    it('should return next available task', async () => {
      const response = await request(app)
        .get('/api/tasks/next')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('type');
    });

    it('should handle unauthorized requests', async () => {
      await request(app)
        .get('/api/tasks/next')
        .expect(401);
    });
  });

  describe('POST /api/tasks/:id/submit', () => {
    it('should submit task answer', async () => {
      const task = await createTestTask(testProject.id);

      const response = await request(app)
        .post(`/api/tasks/${task.id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          answer: { labels: ['cat'] },
          timeSpent: 15000
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('submissionId');
    });
  });
});
```

### E2E Testing

```typescript
// Example: User Journey Test
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { TaskPage } from '../pages/task-page';

test('worker can complete task successfully', async ({ page }) => {
  // Arrange
  const loginPage = new LoginPage(page);
  const taskPage = new TaskPage(page);

  // Act
  await page.goto('/');
  await loginPage.loginAsWorker();
  await expect(page).toHaveURL('/dashboard');

  await taskPage.navigateToTasks();
  await taskPage.selectNextTask();

  // Fill in task form
  await page.fill('[data-testid="task-answer"]', 'cat');
  await page.click('[data-testid="submit-task"]');

  // Assert
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  await expect(page.locator('[data-testid="earnings"]')).toContainText('+');
});
```

## Code Quality

### ESLint Configuration

```javascript
// eslint.config.js
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json', './tsconfig.node.json']
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // React rules
      'react/react-in-jsx-scope': 'error',
      'react/jsx-uses-react': 'error',
      'react/prop-types': 'off', // Using TypeScript for props
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General rules
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error'
    }
  }
];
```

### Prettier Configuration

```javascript
// prettier.config.js
export default {
  semi: false,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  quoteProps: 'as-needed',
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: [
    '^@/types(.*)',
    '^@/config(.*)',
    '^@/lib/(.*)$',
    '^@/components/(.*)$',
    '^@/pages/(.*)$',
    '^@/app/(.*)$',
    '^@/(.*)$',
    '^[./]',
    '^../'
  ]
};
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"]
    },
    "incremental": true,
    "tsBuildInfoFile": "./dist/tsconfig.tsbuildinfo",
    "jsx": "preserve",
    "esModuleInterop": true,
    "moduleSynthesis": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

## Git Workflow

### Branch Protection Rules

```yaml
# .github/branch-protection.yml
protections:
  main:
    required_status_checks:
      strict: true
    required_pull_request_reviews:
      required_approving_review_count: 2
      dismiss_stale_reviews: true
      require_code_owner_reviews: false
    restrictions:
      users: []
      teams: [labelmint-core]
    enforce_admins: true
    required_linear_history: true
    allow_force_pushes: false
    allow_deletions: false
```

### Commit Hooks

```bash
#!/bin/bash
# scripts/pre-commit

echo "🔍 Running pre-commit checks..."

# Run ESLint
echo "Running ESLint..."
pnpm lint --fix
if [ $? -ne 0 ]; then
  echo "❌ ESLint failed"
  exit 1
fi

# Run TypeScript check
echo "Running TypeScript check..."
pnpm type-check
if [ $? -ne 0 ]; then
  echo "❌ TypeScript check failed"
  exit 1
fi

# Run tests
echo "Running tests..."
pnpm test --run
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi

echo "✅ Pre-commit checks passed!"
```

## Pull Request Process

### PR Template

```markdown
## Description
<!-- Describe the changes made in this PR -->

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review of the code
- [ ] Code has been commented appropriately
- [ ] Documentation has been updated (if applicable)
- [ ] No breaking changes without proper version bump
- [ ] All new dependencies have been approved
```

### PR Review Checklist

#### Code Quality
- [ ] Code is clean and readable
- [ ] Functions and variables are well-named
- [ ] Complex logic is well-commented
- [ ] No console.log statements in production code
- [ ] Error handling is appropriate
- [ ] Types are properly defined

#### Testing
- [ ] Tests are comprehensive
- [ ] Tests cover edge cases
- [ ] Test names are descriptive
- [ ] Tests are independent and repeatable
- [ ] Mocks are used appropriately

#### Performance
- [ ] No obvious performance issues
- [ ] Database queries are optimized
- [ ] No memory leaks
- [ ] Appropriate caching is used

#### Security
- [ ] Input validation is implemented
- [ ] No hardcoded secrets
- [ ] Proper error handling doesn't expose sensitive information
- [ ] Authentication/authorization is correct
```

## Code Review Guidelines

### Review Focus Areas

#### 1. Functionality
- Does the code do what it's supposed to do?
- Are edge cases handled properly?
- Is the logic correct and efficient?

#### 2. Code Quality
- Is the code readable and maintainable?
- Are functions and variables well-named?
- Is the code properly structured?
- Are there any obvious bugs or issues?

#### 3. Performance
- Are there any performance bottlenecks?
- Is database access optimized?
- Is caching used appropriately?
- Are there any memory leaks?

#### 4. Security
- Is input validation implemented?
- Are there any security vulnerabilities?
- Is sensitive data properly handled?
- Are authentication/authorization checks in place?

#### 5. Testing
- Are tests comprehensive?
- Do tests cover edge cases?
- Are tests independent and repeatable?
- Are mocks used appropriately?

### Review Process

1. **Initial Review**: Read through the code and understand the changes
2. **Detailed Analysis**: Check each section carefully
3. **Test Verification**: Run tests locally if needed
4. **Feedback**: Provide constructive feedback with specific suggestions
5. **Follow-up**: Verify that issues have been addressed

### Feedback Examples

#### Good Feedback
```
Great work on the task assignment improvements! A few suggestions:

1. **Line 45**: Consider using early return to reduce nesting
2. **Function name**: `calculateScore` could be more descriptive like `calculateWorkerPerformanceScore`
3. **Error handling**: Add more specific error messages for debugging
4. **Tests**: Add a test case for the boundary condition where accuracy = 0.8

The overall approach is solid, just minor polishing needed. ✅
```

#### Poor Feedback
```
This code doesn't work.
```

## Local Development

### Development Scripts

```bash
#!/bin/bash
# scripts/dev/start-all.sh

echo "🚀 Starting LabelMint development environment..."

# Start infrastructure services
echo "Starting infrastructure services..."
docker-compose -f docker-compose.dev.yml up -d postgres redis minio

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "Running database migrations..."
cd services/labeling-backend
pnpm prisma migrate dev
pnpm prisma db seed
cd ../..

# Start development servers
echo "Starting development servers..."
pnpm run dev

echo "✅ Development environment started!"
echo ""
echo "Available services:"
echo "- Web App: http://localhost:3002"
echo "- API Server: http://localhost:3001"
echo "- Admin Panel: http://localhost:3000"
echo "- Telegram Mini App: http://localhost:5173"
echo "- MinIO Console: http://localhost:9001"
echo "- Prisma Studio: http://localhost:5555"
```

### Database Management

```bash
#!/bin/bash
# scripts/db/manage.sh

COMMAND=$1
shift

case $COMMAND in
  "migrate")
    echo "Running database migrations..."
    cd services/labeling-backend
    pnpm prisma migrate dev
    ;;
  "seed")
    echo "Seeding database..."
    cd services/labeling-backend
    pnpm prisma db seed
    ;;
  "reset")
    echo "Resetting database..."
    cd services/labeling-backend
    pnpm prisma migrate reset
    pnpm prisma db seed
    ;;
  "studio")
    echo "Opening Prisma Studio..."
    cd services/labeling-backend
    pnpm prisma studio
    ;;
  *)
    echo "Usage: $0 {migrate|seed|reset|studio}"
    exit 1
    ;;
esac
```

### Testing Scripts

```bash
#!/bin/bash
# scripts/test/run-tests.sh

TYPE=${1:-all}

case $TYPE in
  "unit")
    echo "Running unit tests..."
    pnpm test:unit
    ;;
  "integration")
    echo "Running integration tests..."
    pnpm test:integration
    ;;
  "e2e")
    echo "Running E2E tests..."
    pnpm test:e2e
    ;;
  "coverage")
    echo "Running tests with coverage..."
    pnpm test:coverage
    ;;
  "all")
    echo "Running all tests..."
    pnpm test
    ;;
  *)
    echo "Usage: $0 {unit|integration|e2e|coverage|all}"
    exit 1
    ;;
esac
```

## Debugging

### VS Code Debug Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Labeling Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/services/labeling-backend/dist/index.js",
      "env": {
        "NODE_ENV": "development"
      },
      "outFiles": [
        "${workspaceFolder}/services/labeling-backend/dist/**/*.js"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "openOnSessionStart"
    },
    {
      "name": "Debug Web App",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}/apps/web",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "openOnSessionStart"
    }
  ]
}
```

### Debug Utilities

```typescript
// lib/debug.ts
import config from '../config';

const DEBUG_ENABLED = config.env === 'development' || process.env.DEBUG === 'true';

export class DebugLogger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  log(message: string, data?: any): void {
    if (DEBUG_ENABLED) {
      console.log(`[${this.prefix}] ${message}`, data || '');
    }
  }

  error(message: string, error?: Error): void {
    console.error(`[${this.prefix}] ${message}`, error || '');
  }

  warn(message: string, data?: any): void {
    if (DEBUG_ENABLED) {
      console.warn(`[${this.prefix}] ${message}`, data || '');
    }
  }

  debug(message: string, data?: any): void {
    if (DEBUG_ENABLED) {
      console.debug(`[${this.prefix}] ${message}`, data || '');
    }
  }
}

// Usage
const taskDebug = new DebugLogger('TaskService');
const paymentDebug = new DebugLogger('PaymentService');

// Example usage
taskDebug.debug('Assigning task to worker', { workerId, taskId });
paymentDebug.error('Payment processing failed', error);
```

### Common Debugging Scenarios

#### Database Issues

```typescript
// lib/db-debug.ts
export function debugDatabase() {
  console.log('=== Database Debug Info ===');

  // Test connection
  return pool.query('SELECT 1 as test')
    .then(() => console.log('✅ Database connection successful'))
    .catch(error => console.error('❌ Database connection failed:', error));
}

// Query debugging
export async function debugQuery(query: string, params: any[]) {
  console.log('=== Query Debug ===');
  console.log('Query:', query);
  console.log('Params:', params);

  const start = Date.now();

  try {
    const result = await pool.query(query, params);
    console.log('✅ Query successful');
    console.log('Rows returned:', result.rows.length);
    console.log('Execution time:', Date.now() - start, 'ms');
    return result;
  } catch (error) {
    console.error('❌ Query failed:', error);
    throw error;
  }
}
```

#### API Debugging

```typescript
// lib/api-debug.ts
import { Request, Response, NextFunction } from 'express';

export function debugRequest(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  console.log('=== Request Debug ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', req.headers);
  console.log('Query:', req.query);
  console.log('Body:', req.body);

  // Capture response
  const originalSend = res.send;
  res.send = function (body) {
    console.log('=== Response Debug ===');
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.getHeaders());
    console.log('Body length:', body ? body.length : 0);
    console.log('Execution time:', Date.now() - start, 'ms');

    return originalSend.call(this, body);
  };

  next();
}

// Usage
app.use(debugRequest);
```

## Performance Guidelines

### Database Performance

```typescript
// Optimized database queries
class TaskRepository {
  // Use indexes effectively
  async findAvailableTasks(workerId: string, limit: number = 10): Promise<Task[]> {
    const query = `
      SELECT t.*, p.required_accuracy, p.budget
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.status = 'PENDING'
        AND t.reserved_until IS NULL
        AND t.draft = false
      ORDER BY t.priority DESC, t.created_at ASC
      LIMIT $1
    `;

    return await this.db.query(query, [limit]);
  }

  // Batch operations
  async batchUpdateTasks(taskIds: string[], updates: Partial<Task>): Promise<void> {
    const placeholders = taskIds.map((_, index) => `$${index + 1}`).join(',');
    const updateClauses = Object.keys(updates)
      .map((key, index) => `${key} = $${taskIds.length + index + 1}`)
      .join(', ');

    const query = `
      UPDATE tasks
      SET ${updateClauses}, updated_at = NOW()
      WHERE id IN (${placeholders})
    `;

    const values = [...Object.values(updates), ...taskIds];
    await this.db.query(query, values);
  }

  // Use transactions for consistency
  async createTaskWithSubmission(taskData: CreateTaskData, submissionData: CreateSubmissionData): Promise<void> {
    const tx = await this.db.transaction();

    try {
      // Create task
      const taskResult = await tx.query(
        'INSERT INTO tasks (project_id, type, data) VALUES ($1, $2, $3) RETURNING id',
        [taskData.projectId, taskData.type, taskData.data]
      );

      const taskId = taskResult.rows[0].id;

      // Create submission
      await tx.query(
        'INSERT INTO task_submissions (task_id, worker_id, answer) VALUES ($1, $2, $3)',
        [taskId, submissionData.workerId, submissionData.answer]
      );

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
}
```

### Memory Management

```typescript
// Memory-efficient processing
class TaskProcessor {
  private batchSize = 100;

  async processLargeTaskList(tasks: Task[]): Promise<void> {
    // Process in batches to avoid memory issues
    for (let i = 0; i < tasks.length; i += this.batchSize) {
      const batch = tasks.slice(i, i + this.batchSize);
      await this.processBatch(batch);

      // Force garbage collection periodically
      if (i % (this.batchSize * 10) === 0) {
        if (global.gc) {
          global.gc();
        }
      }
    }
  }

  private async processBatch(batch: Task[]): Promise<void> {
    // Stream processing to avoid loading all data in memory
    const stream = new ReadableStream({
      async start(controller) {
        for (const task of batch) {
          const result = await this.processTask(task);
          controller.enqueue(result);
        }
        controller.close();
      }
    });

    return stream.pipeTo(process.stdout);
  }
}
```

### Caching Strategy

```typescript
// Multi-level caching
class CacheManager {
  private memoryCache = new Map<string, any>();
  private redisCache: Redis;

  constructor(redisCache: Redis) {
    this.redisCache = redisCache;
  }

  async get(key: string): Promise<any> {
    // L1: Memory cache (fastest)
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    // L2: Redis cache (fast)
    const cached = await this.redisCache.get(key);
    if (cached) {
      const data = JSON.parse(cached);
      this.memoryCache.set(key, data);
      return data;
    }

    return null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    // Set in all cache levels
    this.memoryCache.set(key, value);
    await this.redisCache.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    // Invalidate memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Invalidate Redis cache
    const keys = await this.redisCache.keys(`${pattern}*`);
    if (keys.length > 0) {
      await this.redisCache.del(...keys);
    }
  }
}
```

## Documentation Standards

### Code Documentation

```typescript
/**
 * Service for assigning tasks to workers based on their performance and preferences.
 *
 * @example
 * ```typescript
 * const service = new TaskAssignmentService();
 * const task = await service.assignTask('worker-123', preferences);
 * ```
 */
export class TaskAssignmentService {
  /**
   * Assigns a task to a worker based on their eligibility and preferences.
   *
   * @param workerId - The worker's unique identifier
   * @param taskPreferences - The worker's task preferences
   * @param options - Additional assignment options
   * @returns The assigned task or null if no suitable task is found
   *
   * @throws {ValidationError} When worker is not eligible for any tasks
   * @throws {DatabaseError} When database operations fail
   */
  async assignTask(
    workerId: string,
    taskPreferences: TaskPreferences,
    options: AssignmentOptions = {}
  ): Promise<Task | null> {
    // Implementation
  }

  /**
   * Calculates a worker's performance score based on their accuracy and experience.
   *
   * @param worker - The worker to score
   * @returns Performance score between 0 and 100
   */
  private calculateWorkerScore(worker: Worker): number {
    // Implementation
  }
}
```

### API Documentation

```typescript
/**
 * @swagger
 * /api/tasks/{taskId}/submit:
 *   post:
 *     summary: Submit task answer
 *     description: Submits a worker's answer for a specific task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *       - in: body
 *         name: submission
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             answer:
 *               type: object
 *             timeSpent:
 *               type: number
 *     responses:
 *       200:
 *         description: Task submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskSubmission'
 *       400:
 *         description: Invalid submission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
```

## Tools and IDE Setup

### VS Code Settings

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  },
  "typescript.preferences.includePackageJsonAutoImports": "on"
}
```

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "streetsidesoftware.code-spell-checker",
    "ms-vscode.vscode-jest",
    "playwright.playwright",
    "ms-vscode-remote-explorer",
    "eamodio.gitlens",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml"
  ]
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"pnpm run dev:api\" \"pnpm run dev:web\"",
    "dev:api": "cd services/labeling-backend && pnpm dev",
    "dev:web": "cd apps/web && pnpm dev",
    "dev:admin": "cd apps/admin && pnpm dev",
    "dev:mini-app": "cd apps/telegram-mini-app && pnpm dev",
    "build": "pnpm run build:api && pnpm run build:web && pnpm run build:admin",
    "build:api": "cd services/labeling-backend && pnpm build",
    "build:web": "cd apps/web && pnpm build",
    "build:admin": "cd apps/admin && pnpm build",
    "test": "vitest",
    "test:unit": "vitest run src/**/*.test.ts",
    "test:integration": "vitest run test/integration/**/*.test.ts",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "type-check": "tsc --noEmit",
    "db:migrate": "cd services/labeling-backend && pnpm prisma migrate dev",
    "db:seed": "cd services/labeling-backend && pnpm prisma db seed",
    "db:studio": "cd services/labeling-backend && pnpm prisma studio",
    "docker:up": "docker-compose -f docker-compose.dev.yml up -d",
    "docker:down": "docker-compose -f docker-compose.dev.yml down"
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Installation Issues

```bash
# Clear cache and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install

# Check Node.js version
node --version  # Should be 20+
pnpm --version   # Should be 9.15.1+

# Clear npm cache
npm cache clean --force
```

#### 2. Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check connection string
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL -c "SELECT 1;"

# Reset database if needed
pnpm run db:reset
```

#### 3. Port Conflicts

```bash
# Find what's using the port
lsof -i :3001

# Kill the process
kill -9 $(lsof -t -i :3001)

# Or change port in .env file
```

#### 4. TypeScript Errors

```bash
# Check TypeScript version
pnpm tsc --version

# Update TypeScript
pnpm add -D typescript@latest

# Clear TypeScript cache
rm -rf dist tsconfig.tsbuildinfo
```

#### 5. Test Failures

```bash
# Run specific test file
pnpm test task-assignment.test.ts

# Run tests in debug mode
pnpm test --debug

# Check test logs
pnpm test --reporter=verbose
```

### Performance Issues

```bash
# Check memory usage
docker stats

# Monitor process
htop

# Profile Node.js application
node --prof src/index.js
```

## Conclusion

This development guide provides a comprehensive approach to developing the LabelMint platform. Key takeaways:

1. **Follow standards**: Consistent coding standards and practices
2. **Test thoroughly**: Comprehensive testing at all levels
3. **Collaborate effectively**: Code reviews and team workflow
4. **Document code**: Self-documenting code with clear comments
5. **Optimize performance**: Efficient code that scales well
6. **Debug systematically**: Use debugging tools effectively

### Development Success Metrics

- [ ] Code follows established standards
- [ ] Tests are comprehensive and passing
- [ ] Code reviews are thorough and constructive
- [ ] Documentation is complete and up-to-date
- [ ] Performance is optimized
- [ ] Security best practices are followed

### Continuous Improvement

- **Regular reviews**: Quarterly review of development practices
- **Tool updates**: Keep tools and dependencies up to date
- **Training**: Ongoing learning and skill development
- **Feedback**: Regular team feedback and improvement
- **Automation**: Automate repetitive tasks where possible

---

**Last Updated**: 2024-10-24
**Version**: 2.0
**Next Review**: 2025-01-24

This development guide should be updated as practices evolve and new tools are adopted. Regular feedback from the development team will help keep the guide relevant and useful.