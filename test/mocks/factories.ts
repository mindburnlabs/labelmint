import faker from '@faker-js/faker'

// Factory functions for generating test data with realistic content
export function createMockUser(overrides: any = {}) {
  return {
    id: faker.datatype.uuid(),
    email: faker.internet.email(),
    name: faker.name.fullName(),
    telegramId: faker.datatype.number({ min: 100000000, max: 999999999 }).toString(),
    telegramUsername: faker.internet.userName(),
    role: 'annotator',
    status: 'active',
    level: 'beginner',
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

export function createMockProject(overrides: any = {}) {
  const expectedLabels = faker.helpers.arrayElements(
    ['cat', 'dog', 'bird', 'car', 'person', 'tree', 'building', 'food'],
    { min: 2, max: 5 }
  )

  return {
    id: faker.datatype.uuid(),
    name: faker.lorem.words(3).replace(/\b\w/g, l => l.toUpperCase()),
    description: faker.lorem.paragraph(),
    type: faker.helpers.arrayElement(['image_classification', 'text_annotation', 'audio_transcription', 'video_annotation']),
    status: faker.helpers.arrayElement(['draft', 'active', 'completed', 'paused']),
    totalTasks: faker.datatype.number({ min: 1000, max: 50000 }),
    completedTasks: faker.datatype.number({ min: 0, max: 40000 }),
    expectedLabels,
    paymentPerTask: faker.datatype.float({ min: 0.01, max: 0.50, precision: 0.01 }),
    difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
    requirements: {
      minAccuracy: faker.datatype.float({ min: 0.7, max: 0.95, precision: 0.01 }),
      timePerTask: faker.datatype.number({ min: 60, max: 1800 }),
      qualifications: faker.helpers.arrayElements(['basic_training', 'advanced_training', 'certification'], { min: 0, max: 2 }),
    },
    instructions: faker.lorem.paragraphs(2),
    examples: Array.from({ length: faker.datatype.number({ min: 1, max: 5 }) }, () => ({
      imageUrl: faker.image.imageUrl(),
      correctLabels: faker.helpers.arrayElements(expectedLabels, { min: 1, max: 3 }),
    })),
    settings: {
      consensusRequired: faker.datatype.float({ min: 0.6, max: 0.9, precision: 0.01 }),
      minWorkersPerTask: faker.datatype.number({ min: 3, max: 5 }),
      maxWorkersPerTask: faker.datatype.number({ min: 5, max: 10 }),
      timeLimit: faker.datatype.number({ min: 300, max: 3600 }),
    },
    owner: {
      id: faker.datatype.uuid(),
      name: faker.company.name(),
      email: faker.internet.email(),
    },
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    expiresAt: faker.datatype.boolean() ? faker.date.future() : null,
    ...overrides,
  }
}

export function createMockTask(projectId: string, overrides: any = {}) {
  const types = ['image_classification', 'text_annotation', 'audio_transcription', 'video_annotation']
  const type = faker.helpers.arrayElement(types)

  const baseTask = {
    id: faker.datatype.uuid(),
    type,
    projectId,
    status: faker.helpers.arrayElement(['available', 'assigned', 'in_progress', 'completed', 'expired']),
    priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
    difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
    paymentPerLabel: faker.datatype.float({ min: 0.01, max: 0.50, precision: 0.01 }),
    timeLimit: faker.datatype.number({ min: 60, max: 3600 }),
    consensusRequired: faker.datatype.float({ min: 0.6, max: 0.9, precision: 0.01 }),
    requiredLabels: faker.datatype.number({ min: 1, max: 3 }),
    currentLabels: faker.datatype.number({ min: 0, max: 5 }),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    expiresAt: faker.date.future(),
  }

  // Type-specific data
  let typeSpecificData = {}
  let expectedLabels = []

  switch (type) {
    case 'image_classification':
      expectedLabels = faker.helpers.arrayElements(['cat', 'dog', 'bird', 'car', 'person', 'tree'], { min: 2, max: 5 })
      typeSpecificData = {
        imageUrl: faker.image.imageUrl(),
        imageDimensions: {
          width: faker.datatype.number({ min: 400, max: 1920 }),
          height: faker.datatype.number({ min: 300, max: 1080 }),
        },
        expectedLabels,
      }
      break

    case 'text_annotation':
      expectedLabels = faker.helpers.arrayElements(['positive', 'negative', 'neutral'], { min: 2, max: 3 })
      typeSpecificData = {
        text: faker.lorem.paragraphs(3),
        expectedLabels,
      }
      break

    case 'audio_transcription':
      expectedLabels = faker.helpers.arrayElements(['speech', 'music', 'silence', 'noise'], { min: 1, max: 3 })
      typeSpecificData = {
        audioUrl: faker.internet.url(),
        duration: faker.datatype.number({ min: 10, max: 300 }),
        expectedLabels,
      }
      break

    case 'video_annotation':
      expectedLabels = faker.helpers.arrayElements(['person', 'vehicle', 'object', 'background'], { min: 2, max: 4 })
      typeSpecificData = {
        videoUrl: faker.internet.url(),
        duration: faker.datatype.number({ min: 5, max: 120 }),
        frameRate: faker.helpers.arrayElement([24, 30, 60]),
        expectedLabels,
      }
      break
  }

  return {
    ...baseTask,
    ...typeSpecificData,
    instructions: faker.lorem.sentences(2),
    examples: Array.from({ length: faker.datatype.number({ min: 1, max: 3 }) }, () => ({
      content: type === 'text_annotation' ? faker.lorem.sentence() : faker.image.imageUrl(),
      correctLabels: faker.helpers.arrayElements(expectedLabels, { min: 1, max: 2 }),
    })),
    ...overrides,
  }
}

export function createMockLabel(taskId: string, workerId: string, overrides: any = {}) {
  return {
    id: faker.datatype.uuid(),
    taskId,
    workerId,
    labels: faker.helpers.arrayElements(['cat', 'dog', 'bird', 'positive', 'negative'], { min: 1, max: 3 }),
    confidence: faker.datatype.float({ min: 0.6, max: 1.0, precision: 0.01 }),
    timeSpent: faker.datatype.number({ min: 30, max: 600 }),
    notes: faker.datatype.boolean() ? faker.lorem.sentence() : null,
    tools: faker.helpers.arrayElements(['magnifier', 'ruler', 'color_picker'], { min: 0, max: 2 }),
    status: faker.helpers.arrayElement(['submitted', 'reviewed', 'accepted', 'rejected']),
    reviewedBy: faker.datatype.boolean() ? faker.datatype.uuid() : null,
    reviewNotes: faker.datatype.boolean() ? faker.lorem.sentence() : null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}

export function createMockSubmission(taskId: string, workerId: string, overrides: any = {}) {
  return {
    id: faker.datatype.uuid(),
    taskId,
    workerId,
    labels: faker.helpers.arrayElements(['cat', 'dog', 'bird'], { min: 1, max: 2 }),
    confidence: faker.datatype.float({ min: 0.6, max: 1.0, precision: 0.01 }),
    timeSpent: faker.datatype.number({ min: 30, max: 600 }),
    annotationData: {
      regions: Array.from({ length: faker.datatype.number({ min: 0, max: 5 }) }, () => ({
        id: faker.datatype.uuid(),
        type: faker.helpers.arrayElement(['rectangle', 'polygon', 'point']),
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
    status: faker.helpers.arrayElement(['submitted', 'approved', 'rejected']),
    reviewedAt: faker.datatype.boolean() ? faker.date.recent() : null,
    reviewerId: faker.datatype.boolean() ? faker.datatype.uuid() : null,
    feedback: faker.datatype.boolean() ? faker.lorem.sentence() : null,
    payment: {
      amount: faker.datatype.float({ min: 0.01, max: 0.50, precision: 0.01 }),
      currency: 'USDT',
      status: faker.helpers.arrayElement(['pending', 'paid', 'failed']),
      paidAt: faker.datatype.boolean() ? faker.date.recent() : null,
    },
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}

export function createMockPayment(overrides: any = {}) {
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

export function createMockTransaction(overrides: any = {}) {
  return {
    id: faker.random.alphaNumeric(64),
    hash: faker.random.alphaNumeric(64),
    lt: faker.datatype.number({ min: 1000000, max: 9999999 }),
    fromAddress: `EQ${faker.random.alphaNumeric(64)}`,
    toAddress: `EQ${faker.random.alphaNumeric(64)}`,
    amount: faker.datatype.number({ min: 1000000, max: 1000000000 }).toString(), // in nanoTON or similar
    fee: faker.datatype.number({ min: 100000, max: 10000000 }).toString(),
    type: faker.helpers.arrayElement(['transfer', 'contract_call', 'wallet_interaction']),
    status: faker.helpers.arrayElement(['pending', 'completed', 'failed']),
    timestamp: faker.date.past(),
    blockNumber: faker.datatype.number({ min: 1000000, max: 9999999 }),
    message: faker.lorem.sentence(),
    metadata: {
      operation: faker.helpers.arrayElement(['payment', 'smart_contract', 'wallet_operation']),
      contractAddress: faker.datatype.boolean() ? `EQ${faker.random.alphaNumeric(64)}` : null,
    },
    ...overrides,
  }
}

export function createMockWallet(overrides: any = {}) {
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
    transactions: Array.from({ length: faker.datatype.number({ min: 0, max: 10 }) }, createMockTransaction),
    isActive: faker.datatype.boolean(),
    lastUsed: faker.date.recent(),
    createdAt: faker.date.past(),
    ...overrides,
  }
}

// Bulk data creators for performance testing
export function createMockUsers(count: number, overrides: any = {}) {
  return Array.from({ length: count }, (_, index) =>
    createMockUser({ ...overrides, id: overrides.id || `user_${index + 1}` })
  )
}

export function createMockTasks(count: number, projectId: string, overrides: any = {}) {
  return Array.from({ length: count }, (_, index) =>
    createMockTask(projectId, { ...overrides, id: overrides.id || `task_${index + 1}` })
  )
}

export function createMockLabels(count: number, taskId: string, overrides: any = {}) {
  return Array.from({ length: count }, (_, index) =>
    createMockLabel(taskId, `worker_${index + 1}`, overrides)
  )
}

export function createMockPayments(count: number, overrides: any = {}) {
  return Array.from({ length: count }, (_, index) =>
    createMockPayment({ ...overrides, id: overrides.id || `payment_${index + 1}` })
  )
}