import { faker } from '@faker-js/faker'

export enum TaskType {
  IMAGE_CLASSIFICATION = 'IMAGE_CLASSIFICATION',
  TEXT_LABELING = 'TEXT_LABELING',
  BOUNDING_BOX = 'BOUNDING_BOX',
  SENTIMENT_ANALYSIS = 'SENTIMENT_ANALYSIS'
}

export enum TaskState {
  CREATED = 'created',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  PENDING_REVIEW = 'pending_review',
  CONSENSUS_REACHED = 'consensus_reached',
  CONFLICT_DETECTED = 'conflict_detected',
  RESOLVED = 'resolved',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

export interface TaskFactoryData {
  id?: number
  project_id?: number
  type?: TaskType
  data?: Record<string, any>
  status?: TaskState
  required_labels?: number
  current_labels?: number
  assigned_workers?: number[]
  labels?: Array<{
    worker_id: number
    label: string
    confidence?: number
    created_at: Date
  }>
  created_at?: Date
  updated_at?: Date
  expires_at?: Date
}

export const TaskFactory = {
  create: (overrides: TaskFactoryData = {}) => ({
    id: faker.number.int({ min: 1, max: 100000 }),
    project_id: faker.number.int({ min: 1, max: 1000 }),
    type: faker.helpers.arrayElement(Object.values(TaskType)),
    data: {
      image_url: faker.image.url(),
      text: faker.lorem.sentence(),
      ...overrides.data
    },
    status: faker.helpers.arrayElement(Object.values(TaskState)),
    required_labels: 3,
    current_labels: 0,
    assigned_workers: [],
    labels: [],
    created_at: faker.date.past(),
    updated_at: faker.date.recent(),
    expires_at: faker.date.future(),
    ...overrides
  }),

  createMany: (count: number, overrides: TaskFactoryData = {}) =>
    Array.from({ length: count }, () => TaskFactory.create(overrides)),

  createImageClassification: (overrides: TaskFactoryData = {}) =>
    TaskFactory.create({
      type: TaskType.IMAGE_CLASSIFICATION,
      data: {
        image_url: faker.image.url(640, 480, 'nature'),
        categories: ['cat', 'dog', 'bird', 'fish']
      },
      ...overrides
    }),

  createTextLabeling: (overrides: TaskFactoryData = {}) =>
    TaskFactory.create({
      type: TaskType.TEXT_LABELING,
      data: {
        text: faker.lorem.paragraph(),
        labels: ['positive', 'negative', 'neutral']
      },
      ...overrides
    }),

  createWithLabels: (labels: Array<{ worker_id: number; label: string }>, overrides: TaskFactoryData = {}) =>
    TaskFactory.create({
      current_labels: labels.length,
      labels: labels.map(l => ({
        ...l,
        confidence: faker.number.float({ min: 0.7, max: 1, precision: 0.01 }),
        created_at: faker.date.recent()
      })),
      ...overrides
    }),

  createAssigned: (workerIds: number[], overrides: TaskFactoryData = {}) =>
    TaskFactory.create({
      status: TaskState.ASSIGNED,
      assigned_workers: workerIds,
      ...overrides
    })
}