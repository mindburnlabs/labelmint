import { faker } from '@faker-js/faker';
import type { Task, TaskType, TaskStatus, TaskPriority } from '@shared/types/database';

export class TaskFactory {
  static create(overrides: Partial<Task> = {}): Task {
    const now = new Date();
    const id = faker.string.uuid();

    return {
      id,
      projectId: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 3, max: 8 }),
      description: faker.lorem.paragraphs({ min: 1, max: 3 }),
      instructions: faker.lorem.paragraphs({ min: 1, max: 5 }),
      type: faker.helpers.arrayElement<TaskType>([
        'image_classification',
        'text_labeling',
        'bounding_box',
        'semantic_segmentation',
        'sentiment_analysis',
        'transcription',
        'translation',
      ]),
      status: faker.helpers.arrayElement<TaskStatus>([
        'pending',
        'assigned',
        'in_progress',
        'review',
        'completed',
        'cancelled',
      ]),
      priority: faker.helpers.arrayElement<TaskPriority>([
        'low',
        'medium',
        'high',
        'urgent',
      ]),
      assignedTo: faker.datatype.boolean(0.6) ? faker.string.uuid() : null,
      createdBy: faker.string.uuid(),
      labelsRequired: faker.number.int({ min: 3, max: 5 }),
      labelsReceived: faker.number.int({ min: 0, max: 5 }),
      consensusThreshold: faker.number.int({ min: 2, max: 3 }),
      finalLabel: faker.datatype.boolean(0.4) ? faker.lorem.word() : null,
      confidence: faker.datatype.boolean(0.4) ? faker.number.float({ min: 0.5, max: 1, multipleOf: 0.01 }) : null,
      reward: faker.number.float({ min: 0.1, max: 5, multipleOf: 0.01 }),
      timeLimit: faker.number.int({ min: 300, max: 3600 }),
      estimatedTime: faker.number.int({ min: 30, max: 600 }),
      metadata: {
        imageUrl: faker.datatype.boolean(0.5) ? faker.image.url() : undefined,
        categories: faker.helpers.arrayElements(['cat', 'dog', 'car', 'tree', 'person'], { min: 1, max: 3 }),
        difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
        domain: faker.helpers.arrayElement(['ecommerce', 'medical', 'automotive', 'retail']),
      },
      createdAt: faker.date.past({ months: 1 }),
      updatedAt: faker.date.recent({ days: 7 }),
      assignedAt: faker.datatype.boolean(0.5) ? faker.date.recent({ days: 3 }) : null,
      startedAt: faker.datatype.boolean(0.4) ? faker.date.recent({ days: 2 }) : null,
      completedAt: faker.datatype.boolean(0.3) ? faker.date.recent({ days: 1 }) : null,
      expiresAt: faker.date.future({ years: 1 }),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<Task> = {}): Task[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createPending(overrides: Partial<Task> = {}): Task {
    return this.create({
      status: 'pending',
      assignedTo: null,
      labelsReceived: 0,
      ...overrides,
    });
  }

  static createAssigned(overrides: Partial<Task> = {}): Task {
    return this.create({
      status: 'assigned',
      assignedTo: faker.string.uuid(),
      assignedAt: faker.date.recent({ days: 1 }),
      ...overrides,
    });
  }

  static createInProgress(overrides: Partial<Task> = {}): Task {
    return this.create({
      status: 'in_progress',
      assignedTo: faker.string.uuid(),
      assignedAt: faker.date.recent({ days: 1 }),
      startedAt: faker.date.recent({ hours: 2 }),
      ...overrides,
    });
  }

  static createCompleted(overrides: Partial<Task> = {}): Task {
    return this.create({
      status: 'completed',
      assignedTo: faker.string.uuid(),
      labelsReceived: faker.number.int({ min: 3, max: 5 }),
      finalLabel: faker.lorem.word(),
      confidence: faker.number.float({ min: 0.7, max: 1, multipleOf: 0.01 }),
      assignedAt: faker.date.recent({ days: 2 }),
      startedAt: faker.date.recent({ days: 2 }),
      completedAt: faker.date.recent({ hours: 1 }),
      ...overrides,
    });
  }

  static createHoneypot(overrides: Partial<Task> = {}): Task {
    return this.create({
      type: 'image_classification',
      status: 'pending',
      isHoneypot: true,
      expectedLabel: faker.helpers.arrayElement(['cat', 'dog', 'car']),
      labelsRequired: 1,
      consensusThreshold: 1,
      reward: 0.5,
      metadata: {
        imageUrl: faker.image.url({ width: 300, height: 300 }),
        categories: ['cat', 'dog', 'car'],
        difficulty: 'easy',
        isHoneypot: true,
      },
      ...overrides,
    });
  }

  static createWithProject(projectId: string, overrides: Partial<Task> = {}): Task {
    return this.create({
      projectId,
      ...overrides,
    });
  }

  static createBatch(params: {
    count: number;
    projectId?: string;
    type?: TaskType;
    status?: TaskStatus;
    createdBy?: string;
  }): Task[] {
    const { count, ...overrides } = params;
    return this.createMany(count, overrides);
  }

  // Create tasks with specific status distribution
  static createDistribution(count: number): Task[] {
    const distribution = {
      pending: Math.floor(count * 0.3),
      assigned: Math.floor(count * 0.2),
      in_progress: Math.floor(count * 0.15),
      review: Math.floor(count * 0.15),
      completed: Math.floor(count * 0.15),
      cancelled: Math.floor(count * 0.05),
    };

    const tasks: Task[] = [];

    Object.entries(distribution).forEach(([status, count]) => {
      for (let i = 0; i < count; i++) {
        tasks.push(this.create({ status: status as TaskStatus }));
      }
    });

    // Fill remaining if distribution doesn't sum to count
    while (tasks.length < count) {
      tasks.push(this.create());
    }

    return tasks;
  }

  // For database insertion
  static createForInsert(overrides: Partial<Task> = {}): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> {
    const task = this.create(overrides);
    const { id, createdAt, updatedAt, ...insertData } = task;
    return insertData;
  }
}