import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole, TaskStatus, PaymentStatus } from '@prisma/client';
import { testDb } from '../setup';

// User Factory
export const createTestUser = async (overrides: Partial<any> = {}) => {
  const userData = {
    telegramId: faker.number.int({ min: 1000000, max: 9999999 }),
    telegramUsername: faker.internet.userName(),
    telegramFirstName: faker.name.firstName(),
    telegramLastName: faker.name.lastName(),
    telegramPhotoUrl: faker.internet.url(),
    email: faker.internet.email(),
    role: faker.helpers.arrayElement([UserRole.WORKER, UserRole.CLIENT, UserRole.ADMIN]),
    reputation: faker.number.int({ min: 0, max: 100 }),
    isBanned: false,
    isVerified: faker.datatype.boolean(),
    language: 'en',
    timezone: 'UTC',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };

  return await testDb.user.create({ data: userData });
};

// Project Factory
export const createTestProject = async (clientId: number, overrides: Partial<any> = {}) => {
  const projectData = {
    name: faker.lorem.words(3),
    description: faker.lorem.paragraphs(2),
    instructions: faker.lorem.paragraph(),
    categoryId: faker.number.int({ min: 1, max: 10 }),
    clientId,
    budget: parseFloat(faker.finance.amount(100, 10000, 2)),
    totalTasks: faker.number.int({ min: 10, max: 1000 }),
    tasksPerWorker: faker.number.int({ min: 1, max: 10 }),
    consensusRequired: faker.number.int({ min: 1, max: 5 }),
    paymentPerTask: parseFloat(faker.finance.amount(0.1, 10, 2)),
    status: 'ACTIVE',
    deadline: faker.date.future(),
    tags: [faker.lorem.word(), faker.lorem.word()],
    difficulty: faker.helpers.arrayElement(['EASY', 'MEDIUM', 'HARD']),
    requiresQualification: faker.datatype.boolean(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };

  return await testDb.project.create({
    data: projectData,
    include: { client: true }
  });
};

// Task Factory
export const createTestTask = async (projectId: number, overrides: Partial<any> = {}) => {
  const taskData = {
    projectId,
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    imageUrl: faker.internet.url(),
    expectedLabels: faker.lorem.words(3).split(' '),
    category: faker.lorem.word(),
    difficulty: faker.helpers.arrayElement(['EASY', 'MEDIUM', 'HARD']),
    estimatedTime: faker.number.int({ min: 30, max: 300 }), // seconds
    reward: parseFloat(faker.finance.amount(0.1, 5, 2)),
    status: TaskStatus.AVAILABLE,
    assignedWorkers: [],
    completedWorkers: [],
    consensusLabels: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };

  return await testDb.task.create({
    data: taskData,
    include: { project: true }
  });
};

// Label Factory
export const createTestLabel = async (taskId: number, workerId: number, overrides: Partial<any> = {}) => {
  const labelData = {
    taskId,
    workerId,
    labels: [faker.lorem.word(), faker.lorem.word()],
    confidence: faker.number.int({ min: 0, max: 100 }),
    timeSpent: faker.number.int({ min: 10, max: 120 }),
    isHoneypot: faker.datatype.boolean(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };

  return await testDb.label.create({ data: labelData });
};

// Transaction Factory
export const createTestTransaction = async (userId: number, overrides: Partial<any> = {}) => {
  const transactionData = {
    userId,
    type: faker.helpers.arrayElement(['DEPOSIT', 'WITHDRAWAL', 'TASK_PAYMENT', 'REFUND']),
    amount: parseFloat(faker.finance.amount(1, 1000, 2)),
    currency: faker.helpers.arrayElement(['TON', 'USDT']),
    status: PaymentStatus.PENDING,
    fromAddress: faker.finance.ethereumAddress(),
    toAddress: faker.finance.ethereumAddress(),
    blockchainTxHash: faker.datatype.string(64),
    metadata: {
      description: faker.lorem.sentence(),
      taskId: faker.number.int(),
      projectId: faker.number.int()
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };

  return await testDb.transaction.create({ data: transactionData });
};

// Wallet Factory
export const createTestWallet = async (userId: number, overrides: Partial<any> = {}) => {
  const walletData = {
    userId,
    address: faker.finance.ethereumAddress(),
    currency: faker.helpers.arrayElement(['TON', 'USDT']),
    balance: parseFloat(faker.finance.amount(0, 1000, 2)),
    isMain: faker.datatype.boolean(),
    publicKey: faker.datatype.string(64),
    mnemonicEncrypted: faker.datatype.string(128),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };

  return await testDb.wallet.create({ data: walletData });
};

// Bulk data creation utilities
export const createTestDataset = async (config: {
  numUsers: number;
  numProjects: number;
  numTasks: number;
  numLabels: number;
}) => {
  const users = [];
  const projects = [];
  const tasks = [];
  const labels = [];

  // Create users
  for (let i = 0; i < config.numUsers; i++) {
    users.push(await createTestUser());
  }

  const clients = users.filter(u => u.role === UserRole.CLIENT);
  const workers = users.filter(u => u.role === UserRole.WORKER);

  // Create projects
  for (let i = 0; i < config.numProjects && clients.length > 0; i++) {
    const client = clients[i % clients.length];
    projects.push(await createTestProject(client.id));
  }

  // Create tasks
  for (let i = 0; i < config.numTasks && projects.length > 0; i++) {
    const project = projects[i % projects.length];
    tasks.push(await createTestTask(project.id));
  }

  // Create labels
  for (let i = 0; i < config.numLabels && tasks.length > 0 && workers.length > 0; i++) {
    const task = tasks[i % tasks.length];
    const worker = workers[i % workers.length];
    labels.push(await createTestLabel(task.id, worker.id));
  }

  return { users, projects, tasks, labels };
};

// Honeypot task factory
export const createHoneypotTask = async (projectId: number, correctLabels: string[]) => {
  return await createTestTask(projectId, {
    isHoneypot: true,
    expectedLabels: correctLabels,
    difficulty: 'EASY',
    reward: 5.0 // Higher reward for honeypots
  });
};

// Quality control data factory
export const createQualityTestSet = async (numCorrect: number, numIncorrect: number) => {
  const correctLabels = [];
  const incorrectLabels = [];

  // Create correct labels
  for (let i = 0; i < numCorrect; i++) {
    const task = await createTestTask(faker.number.int());
    correctLabels.push(
      await createTestLabel(task.id, faker.number.int(), {
        labels: task.expectedLabels,
        confidence: 95
      })
    );
  }

  // Create incorrect labels
  for (let i = 0; i < numIncorrect; i++) {
    const task = await createTestTask(faker.number.int());
    incorrectLabels.push(
      await createTestLabel(task.id, faker.number.int(), {
        labels: ['incorrect', 'label'],
        confidence: 30
      })
    );
  }

  return { correctLabels, incorrectLabels };
};

// Consensus test factory
export const createConsensusScenario = async (taskId: number, numWorkers: number, consensusRatio: number) => {
  const task = await testDb.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');

  const labels = [];
  const consensusCount = Math.floor(numWorkers * consensusRatio);

  // Create consensus labels
  for (let i = 0; i < consensusCount; i++) {
    labels.push(
      await createTestLabel(taskId, faker.number.int(), {
        labels: task.expectedLabels,
        confidence: 90
      })
    );
  }

  // Create non-consensus labels
  for (let i = consensusCount; i < numWorkers; i++) {
    labels.push(
      await createTestLabel(taskId, faker.number.int(), {
        labels: ['different', 'label'],
        confidence: 60
      })
    );
  }

  return labels;
};