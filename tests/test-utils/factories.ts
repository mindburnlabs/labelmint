// Test Data Factories
// ===================
// Factory functions for creating realistic test data

import { faker } from '@faker-js/faker'

// User factory
export const createUser = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  username: faker.internet.userName(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  role: 'user',
  status: 'active',
  telegramId: faker.string.numeric({ length: 9 }),
  tonWallet: faker.finance.ethereumAddress(),
  avatar: faker.image.avatar(),
  bio: faker.lorem.paragraph(),
  reputation: faker.number.int({ min: 0, max: 100 }),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
})

// Project factory
export const createProject = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  name: faker.commerce.productName(),
  description: faker.lorem.paragraphs(2),
  status: 'active',
  budget: faker.number.int({ min: 100, max: 10000 }),
  deadline: faker.date.future(),
  requirements: faker.lorem.paragraph(),
  instructions: faker.lorem.sentences(3),
  category: faker.helpers.arrayElement([
    'image_classification',
    'text_annotation',
    'data_collection',
    'sentiment_analysis',
    'object_detection',
  ]),
  createdBy: faker.string.uuid(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  stats: {
    totalTasks: faker.number.int({ min: 10, max: 1000 }),
    completedTasks: faker.number.int({ min: 0, max: 100 }),
    pendingTasks: faker.number.int({ min: 0, max: 100 }),
    averageTime: faker.number.int({ min: 30, max: 300 }),
    accuracy: faker.number.float({ min: 0.8, max: 1.0, precision: 0.01 }),
  },
  ...overrides,
})

// Task factory
export const createTask = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  projectId: faker.string.uuid(),
  title: faker.lorem.sentence(),
  description: faker.lorem.paragraph(),
  status: 'pending',
  reward: faker.number.int({ min: 1, max: 100 }),
  type: faker.helpers.arrayElement([
    'image_classification',
    'text_annotation',
    'sentiment_analysis',
    'object_detection',
    'data_validation',
  ]),
  data: {
    imageUrl: faker.image.url({ width: 640, height: 480 }),
    text: faker.lorem.paragraph(),
    options: faker.helpers.arrayElements(['Option A', 'Option B', 'Option C', 'Option D']),
    metadata: {
      source: faker.helpers.arrayElement(['web', 'mobile', 'api']),
      tags: faker.helpers.arrayElements(['urgent', 'important', 'review']),
    },
  },
  requirements: faker.lorem.sentences(2),
  timeLimit: faker.number.int({ min: 30, max: 600 }),
  difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
  assignedTo: null,
  completedBy: null,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
})

// Task submission factory
export const createSubmission = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  taskId: faker.string.uuid(),
  userId: faker.string.uuid(),
  data: {
    labels: faker.helpers.arrayElements(['label1', 'label2', 'label3']),
    coordinates: [
      { x: faker.number.int({ min: 0, max: 100 }), y: faker.number.int({ min: 0, max: 100 }) },
    ],
    text: faker.lorem.sentence(),
    rating: faker.number.int({ min: 1, max: 5 }),
    notes: faker.lorem.paragraph(),
  },
  timeSpent: faker.number.int({ min: 30, max: 600 }),
  status: 'pending',
  accuracy: faker.number.float({ min: 0.5, max: 1.0, precision: 0.01 }),
  consensusScore: faker.number.float({ min: 0, max: 1.0, precision: 0.01 }),
  reviewedBy: null,
  reviewNotes: null,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
})

// Payment transaction factory
export const createTransaction = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  projectId: faker.string.uuid(),
  taskId: faker.string.uuid(),
  amount: faker.number.int({ min: 1, max: 1000 }),
  currency: faker.helpers.arrayElement(['USDT', 'TON']),
  type: faker.helpers.arrayElement(['reward', 'withdrawal', 'deposit', 'refund']),
  status: faker.helpers.arrayElement(['pending', 'completed', 'failed', 'cancelled']),
  fromAddress: faker.finance.ethereumAddress(),
  toAddress: faker.finance.ethereumAddress(),
  blockchainHash: faker.string.alphanumeric({ length: 64 }),
  blockNumber: faker.number.int({ min: 1, max: 1000000 }),
  gasUsed: faker.number.int({ min: 21000, max: 500000 }),
  gasPrice: faker.number.int({ min: 1, max: 1000 }),
  fees: faker.number.float({ min: 0.01, max: 10, precision: 0.01 }),
  metadata: {
    source: faker.helpers.arrayElement(['task_completion', 'withdrawal', 'refund']),
    reason: faker.lorem.sentence(),
  },
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  completedAt: faker.helpers.arrayElement([faker.date.recent(), null]),
  ...overrides,
})

// Wallet factory
export const createWallet = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  address: faker.finance.ethereumAddress(),
  type: faker.helpers.arrayElement(['TON', 'USDT', 'ETH']),
  balance: faker.number.float({ min: 0, max: 10000, precision: 0.01 }),
  frozenBalance: faker.number.float({ min: 0, max: 1000, precision: 0.01 }),
  status: 'active',
  isDefault: faker.datatype.boolean(),
  metadata: {
    network: faker.helpers.arrayElement(['mainnet', 'testnet']),
    label: faker.lorem.words(2),
  },
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
})

// Organization factory
export const createOrganization = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  domain: faker.internet.domainName(),
  description: faker.company.catchPhrase(),
  plan: faker.helpers.arrayElement(['TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  status: 'active',
  settings: {
    allowPublicProjects: faker.datatype.boolean(),
    requireApproval: faker.datatype.boolean(),
    maxUsers: faker.number.int({ min: 5, max: 1000 }),
    theme: faker.helpers.arrayElement(['light', 'dark', 'auto']),
  },
  subscription: {
    id: faker.string.uuid(),
    status: 'active',
    currentPeriodStart: faker.date.past(),
    currentPeriodEnd: faker.date.future(),
    cancelAtPeriodEnd: faker.datatype.boolean(),
  },
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
})

// Analytics data factory
export const createAnalyticsData = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  organizationId: faker.string.uuid(),
  projectId: faker.string.uuid(),
  date: faker.date.recent(),
  metrics: {
    totalUsers: faker.number.int({ min: 0, max: 10000 }),
    activeUsers: faker.number.int({ min: 0, max: 1000 }),
    newUsers: faker.number.int({ min: 0, max: 100 }),
    totalTasks: faker.number.int({ min: 0, max: 100000 }),
    completedTasks: faker.number.int({ min: 0, max: 50000 }),
    averageCompletionTime: faker.number.float({ min: 30, max: 600, precision: 0.1 }),
    totalRevenue: faker.number.float({ min: 0, max: 100000, precision: 0.01 }),
    averageAccuracy: faker.number.float({ min: 0.7, max: 1.0, precision: 0.01 }),
    userSatisfaction: faker.number.float({ min: 1, max: 5, precision: 0.1 }),
  },
  dimensions: {
    userType: faker.helpers.arrayElement(['worker', 'client', 'admin']),
    deviceType: faker.helpers.arrayElement(['mobile', 'desktop', 'tablet']),
    region: faker.location.countryCode(),
    taskType: faker.helpers.arrayElement([
      'image_classification',
      'text_annotation',
      'sentiment_analysis',
    ]),
  },
  createdAt: faker.date.past(),
  ...overrides,
})

// Error factory
export const createError = (overrides: Partial<any> = {}) => ({
  name: faker.helpers.arrayElement([
    'ValidationError',
    'AuthenticationError',
    'AuthorizationError',
    'NotFoundError',
    'PaymentError',
    'NetworkError',
    'DatabaseError',
  ]),
  message: faker.lorem.sentence(),
  code: faker.string.alphanumeric({ length: 6 }).toUpperCase(),
  status: faker.number.int({ min: 400, max: 599 }),
  details: {
    field: faker.lorem.words(1),
    value: faker.lorem.words(2),
    constraint: faker.lorem.sentence(),
  },
  stack: faker.helpers.multiple(() => faker.lorem.lines(1), { count: 5 }).join('\n'),
  timestamp: faker.date.recent(),
  ...overrides,
})

// API response factory
export const createApiResponse = (overrides: Partial<any> = {}) => ({
  success: true,
  data: {},
  message: faker.lorem.sentence(),
  pagination: {
    page: faker.number.int({ min: 1, max: 10 }),
    limit: faker.number.int({ min: 10, max: 100 }),
    total: faker.number.int({ min: 0, max: 1000 }),
    totalPages: faker.number.int({ min: 1, max: 20 }),
  },
  meta: {
    requestId: faker.string.uuid(),
    timestamp: faker.date.recent(),
    version: '1.0.0',
  },
  ...overrides,
})

// Performance metrics factory
export const createPerformanceMetrics = (overrides: Partial<any> = {}) => ({
  responseTime: faker.number.float({ min: 10, max: 5000, precision: 0.1 }),
  throughput: faker.number.float({ min: 1, max: 1000, precision: 0.1 }),
  errorRate: faker.number.float({ min: 0, max: 0.1, precision: 0.001 }),
  cpuUsage: faker.number.float({ min: 0, max: 100, precision: 0.1 }),
  memoryUsage: faker.number.float({ min: 0, max: 100, precision: 0.1 }),
  diskUsage: faker.number.float({ min: 0, max: 100, precision: 0.1 }),
  networkIO: {
    bytesIn: faker.number.int({ min: 0, max: 1000000 }),
    bytesOut: faker.number.int({ min: 0, max: 1000000 }),
  },
  timestamp: faker.date.recent(),
  ...overrides,
})

// Load testing scenario factory
export const createLoadTestScenario = (overrides: Partial<any> = {}) => ({
  name: faker.lorem.words(3),
  description: faker.lorem.paragraph(),
  duration: faker.number.int({ min: 60, max: 3600 }),
  users: faker.number.int({ min: 10, max: 10000 }),
  rampUp: faker.number.int({ min: 10, max: 300 }),
  thinkTime: faker.number.float({ min: 0.5, max: 10, precision: 0.1 }),
  requests: [
    {
      method: faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
      path: faker.helpers.arrayElement([
        '/api/projects',
        '/api/tasks',
        '/api/users',
        '/api/transactions',
      ]),
      weight: faker.number.int({ min: 1, max: 10 }),
      headers: {},
      body: {},
    },
  ],
  targets: {
    responseTime95: faker.number.int({ min: 100, max: 2000 }),
    errorRate: faker.number.float({ min: 0, max: 0.01, precision: 0.001 }),
    throughput: faker.number.float({ min: 100, max: 10000, precision: 0.1 }),
  },
  ...overrides,
})