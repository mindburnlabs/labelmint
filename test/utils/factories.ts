// Factory functions for generating test data with realistic content
import faker from '@faker-js/faker'

export function createTestTask(id: number, overrides: any = {}) {
  const taskId = `task_${id}`
  const types = ['image_classification', 'text_annotation', 'audio_transcription']
  const type = types[id % types.length]

  let expectedLabels: string[] = []
  let content: any = {}

  switch (type) {
    case 'image_classification':
      expectedLabels = ['cat', 'dog', 'bird', 'car', 'person']
      content = {
        imageUrl: faker.image.imageUrl(),
        imageDimensions: {
          width: faker.datatype.number({ min: 400, max: 1920 }),
          height: faker.datatype.number({ min: 300, max: 1080 }),
        },
      }
      break
    case 'text_annotation':
      expectedLabels = ['positive', 'negative', 'neutral']
      content = {
        text: faker.lorem.paragraph(),
      }
      break
    case 'audio_transcription':
      expectedLabels = ['speech', 'music', 'silence', 'noise']
      content = {
        audioUrl: faker.internet.url(),
        duration: faker.datatype.number({ min: 10, max: 300 }),
      }
      break
  }

  return {
    id: taskId,
    type,
    status: 'available',
    priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
    difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
    expectedLabels,
    timeLimit: faker.datatype.number({ min: 60, max: 1800 }),
    consensusRequired: 0.7,
    requiredLabels: 3,
    currentLabels: 0,
    paymentPerLabel: faker.datatype.float({ min: 0.01, max: 0.50, precision: 0.01 }),
    instructions: faker.lorem.sentences(2),
    projectId: faker.datatype.uuid(),
    ...content,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    expiresAt: faker.date.future(),
    ...overrides,
  }
}

export function createTestLabel(taskId: string, workerId: number, overrides: any = {}) {
  const labelId = `label_${taskId}_${workerId}`

  return {
    id: labelId,
    taskId,
    workerId,
    labels: faker.helpers.arrayElements(['cat', 'dog', 'bird', 'positive', 'negative'], { min: 1, max: 3 }),
    confidence: faker.datatype.float({ min: 0.6, max: 1.0, precision: 0.01 }),
    timeSpent: faker.datatype.number({ min: 30, max: 600 }),
    notes: faker.datatype.boolean() ? faker.lorem.sentence() : null,
    annotationData: {
      regions: Array.from({ length: faker.datatype.number({ min: 0, max: 5 }) }, () => ({
        id: faker.datatype.uuid(),
        type: 'rectangle',
        coordinates: {
          x: faker.datatype.number({ min: 0, max: 800 }),
          y: faker.datatype.number({ min: 0, max: 600 }),
          width: faker.datatype.number({ min: 10, max: 200 }),
          height: faker.datatype.number({ min: 10, max: 200 }),
        },
        label: faker.helpers.arrayElement(['cat', 'dog', 'bird']),
        confidence: faker.datatype.float({ min: 0.6, max: 1.0, precision: 0.01 }),
      })),
    },
    status: 'submitted',
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}

export function createTestProject(overrides: any = {}) {
  const expectedLabels = faker.helpers.arrayElements(
    ['cat', 'dog', 'bird', 'car', 'person', 'tree'],
    { min: 2, max: 5 }
  )

  return {
    id: faker.datatype.uuid(),
    name: faker.lorem.words(3),
    description: faker.lorem.paragraph(),
    type: faker.helpers.arrayElement(['image_classification', 'text_annotation']),
    status: 'active',
    totalTasks: faker.datatype.number({ min: 1000, max: 50000 }),
    completedTasks: faker.datatype.number({ min: 0, max: 40000 }),
    expectedLabels,
    paymentPerTask: faker.datatype.float({ min: 0.01, max: 0.50, precision: 0.01 }),
    difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
    requirements: {
      minAccuracy: faker.datatype.float({ min: 0.7, max: 0.95, precision: 0.01 }),
      timePerTask: faker.datatype.number({ min: 60, max: 1800 }),
    },
    owner: {
      id: faker.datatype.uuid(),
      name: faker.company.name(),
      email: faker.internet.email(),
    },
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}

export function createTestUser(overrides: any = {}) {
  return {
    id: faker.datatype.uuid(),
    email: faker.internet.email(),
    name: faker.name.fullName(),
    telegramId: faker.datatype.number({ min: 100000000, max: 999999999 }).toString(),
    telegramUsername: faker.internet.userName(),
    role: faker.helpers.arrayElement(['annotator', 'reviewer', 'admin']),
    status: 'active',
    level: faker.helpers.arrayElement(['beginner', 'intermediate', 'expert']),
    accuracy: faker.datatype.float({ min: 0.7, max: 1.0, precision: 0.01 }),
    totalTasks: faker.datatype.number({ min: 0, max: 1000 }),
    completedTasks: faker.datatype.number({ min: 0, max: 800 }),
    rejectedTasks: faker.datatype.number({ min: 0, max: 200 }),
    totalEarnings: faker.datatype.float({ min: 0, max: 5000, precision: 0.01 }),
    averageTimePerTask: faker.datatype.number({ min: 60, max: 600 }),
    rating: faker.datatype.float({ min: 3.0, max: 5.0, precision: 0.1 }),
    phoneNumber: faker.phone.number(),
    walletAddress: `EQ${faker.random.alphaNumeric(64)}`,
    isEmailVerified: true,
    isPhoneVerified: faker.datatype.boolean(),
    preferredLanguage: faker.helpers.arrayElement(['en', 'es', 'ru', 'zh']),
    timezone: faker.address.timeZone(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    lastActiveAt: faker.date.recent(),
    ...overrides,
  }
}

export function createTestPayment(overrides: any = {}) {
  return {
    id: faker.datatype.uuid(),
    userId: faker.datatype.uuid(),
    type: faker.helpers.arrayElement(['earning', 'withdrawal', 'refund']),
    amount: faker.datatype.float({ min: 0.01, max: 1000, precision: 0.01 }),
    currency: 'USDT',
    status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
    taskId: faker.datatype.boolean() ? faker.datatype.uuid() : null,
    transactionHash: faker.datatype.boolean() ? faker.random.alphaNumeric(64) : null,
    networkFee: faker.datatype.float({ min: 0.001, max: 0.05, precision: 0.001 }),
    address: faker.datatype.boolean() ? `EQ${faker.random.alphaNumeric(64)}` : null,
    metadata: {
      description: faker.lorem.sentence(),
      category: faker.helpers.arrayElement(['task_completion', 'withdrawal', 'bonus']),
    },
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    completedAt: faker.datatype.boolean() ? faker.date.recent() : null,
    ...overrides,
  }
}

export function createTestWallet(overrides: any = {}) {
  return {
    address: `EQ${faker.random.alphaNumeric(64)}`,
    publicKey: faker.random.alphaNumeric(64),
    mnemonic: Array.from({ length: 12 }, () => faker.lorem.word()).join(' '),
    workchain: 0,
    subwalletId: faker.datatype.number({ min: 0, max: 255 }),
    balance: {
      ton: faker.datatype.float({ min: 0, max: 1000, precision: 0.001 }).toString(),
      usdt: faker.datatype.float({ min: 0, max: 10000, precision: 0.01 }).toString(),
    },
    isActive: faker.datatype.boolean(),
    lastUsed: faker.date.recent(),
    createdAt: faker.date.past(),
    ...overrides,
  }
}

export function createMockTelegramUpdate(overrides: any = {}) {
  return {
    update_id: faker.datatype.number({ min: 1000000, max: 9999999 }),
    message: {
      message_id: faker.datatype.number({ min: 1, max: 999999 }),
      from: {
        id: faker.datatype.number({ min: 100000000, max: 999999999 }),
        is_bot: false,
        first_name: faker.name.firstName(),
        last_name: faker.name.lastName(),
        username: faker.internet.userName(),
        language_code: 'en',
      },
      chat: {
        id: faker.datatype.number({ min: 100000000, max: 999999999 }),
        first_name: faker.name.firstName(),
        last_name: faker.name.lastName(),
        username: faker.internet.userName(),
        type: 'private',
      },
      date: Math.floor(Date.now() / 1000),
      text: faker.lorem.sentence(),
    },
    ...overrides,
  }
}