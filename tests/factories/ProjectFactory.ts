import { faker } from '@faker-js/faker';
import type { Project, ProjectStatus } from '@shared/types/database';

export class ProjectFactory {
  static create(overrides: Partial<Project> = {}): Project {
    const now = new Date();
    const id = faker.string.uuid();

    return {
      id,
      name: faker.lorem.words({ min: 2, max: 4 }),
      description: faker.lorem.paragraphs({ min: 1, max: 3 }),
      instructions: faker.lorem.paragraphs({ min: 2, max: 5 }),
      status: faker.helpers.arrayElement<ProjectStatus>(['draft', 'active', 'paused', 'completed', 'archived']),
      ownerId: faker.string.uuid(),
      budget: faker.number.float({ min: 100, max: 10000, multipleOf: 0.01 }),
      budgetSpent: faker.number.float({ min: 0, max: 5000, multipleOf: 0.01 }),
      taskReward: faker.number.float({ min: 0.1, max: 5, multipleOf: 0.01 }),
      totalTasks: faker.number.int({ min: 10, max: 1000 }),
      completedTasks: faker.number.int({ min: 0, max: 800 }),
      labelsPerTask: faker.number.int({ min: 3, max: 5 }),
      consensusThreshold: faker.number.int({ min: 2, max: 3 }),
      category: faker.helpers.arrayElement(['image', 'text', 'audio', 'video', 'mixed']),
      metadata: {
        domain: faker.helpers.arrayElement(['ecommerce', 'medical', 'automotive', 'retail', 'finance']),
        difficulty: faker.helpers.arrayElement(['beginner', 'intermediate', 'expert']),
        tags: faker.helpers.arrayElements(['urgent', 'high-priority', 'research', 'production']),
        requirements: {
          minAccuracy: faker.number.float({ min: 0.7, max: 0.95, multipleOf: 0.01 }),
          minReputation: faker.number.int({ min: 50, max: 90 }),
          languages: faker.helpers.arrayElements(['en', 'es', 'fr', 'de']),
          timezone: faker.location.timeZone(),
        },
        examples: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
          input: faker.lorem.sentence(),
          output: faker.lorem.word(),
          explanation: faker.lorem.sentence(),
        })),
      },
      settings: {
        autoAssignment: faker.datatype.boolean(),
        allowMultipleWorkers: true,
        requireVerification: faker.datatype.boolean(),
        enableHoneypots: faker.datatype.boolean(),
        honeypotPercentage: faker.number.int({ min: 5, max: 20 }),
        maxLabelsPerWorker: faker.number.int({ min: 10, max: 100 }),
        timeLimitPerTask: faker.number.int({ min: 300, max: 3600 }),
        gracePeriod: faker.number.int({ min: 60, max: 300 }),
      },
      createdAt: faker.date.past({ months: 3 }),
      updatedAt: faker.date.recent({ days: 7 }),
      publishedAt: faker.datatype.boolean(0.7) ? faker.date.past({ months: 1 }) : null,
      completedAt: faker.datatype.boolean(0.2) ? faker.date.recent({ days: 30 }) : null,
      archivedAt: faker.datatype.boolean(0.1) ? faker.date.recent({ days: 90 }) : null,
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<Project> = {}): Project[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createDraft(overrides: Partial<Project> = {}): Project {
    return this.create({
      status: 'draft',
      publishedAt: null,
      completedTasks: 0,
      ...overrides,
    });
  }

  static createActive(overrides: Partial<Project> = {}): Project {
    const totalTasks = faker.number.int({ min: 50, max: 500 });
    const completedTasks = faker.number.int({ min: 0, max: totalTasks });

    return this.create({
      status: 'active',
      totalTasks,
      completedTasks,
      publishedAt: faker.date.past({ months: 1 }),
      ...overrides,
    });
  }

  static createCompleted(overrides: Partial<Project> = {}): Project {
    const totalTasks = faker.number.int({ min: 100, max: 1000 });

    return this.create({
      status: 'completed',
      totalTasks,
      completedTasks: totalTasks,
      budgetSpent: faker.number.float({ min: 100, max: 10000, multipleOf: 0.01 }),
      publishedAt: faker.date.past({ months: 2 }),
      completedAt: faker.date.past({ months: 1 }),
      ...overrides,
    });
  }

  static createWithOwner(ownerId: string, overrides: Partial<Project> = {}): Project {
    return this.create({
      ownerId,
      ...overrides,
    });
  }

  static createWithBudget(budget: number, overrides: Partial<Project> = {}): Project {
    return this.create({
      budget,
      budgetSpent: faker.number.float({ min: 0, max: budget * 0.8, multipleOf: 0.01 }),
      taskReward: budget / faker.number.int({ min: 100, max: 1000 }),
      ...overrides,
    });
  }

  static createImageClassification(overrides: Partial<Project> = {}): Project {
    return this.create({
      name: 'Image Classification Project',
      category: 'image',
      description: 'Classify images into predefined categories',
      instructions: faker.lorem.paragraphs({ min: 2, max: 4 }),
      metadata: {
        domain: 'automotive',
        difficulty: 'beginner',
        tags: ['computer-vision', 'classification'],
        ...overrides.metadata,
      },
      ...overrides,
    });
  }

  static createSentimentAnalysis(overrides: Partial<Project> = {}): Project {
    return this.create({
      name: 'Sentiment Analysis Project',
      category: 'text',
      description: 'Analyze sentiment of text reviews',
      instructions: faker.lorem.paragraphs({ min: 2, max: 4 }),
      metadata: {
        domain: 'retail',
        difficulty: 'intermediate',
        tags: ['nlp', 'sentiment'],
        ...overrides.metadata,
      },
      ...overrides,
    });
  }

  static createWithHoneypots(overrides: Partial<Project> = {}): Project {
    return this.create({
      settings: {
        autoAssignment: true,
        allowMultipleWorkers: true,
        requireVerification: true,
        enableHoneypots: true,
        honeypotPercentage: faker.number.int({ min: 10, max: 15 }),
        maxLabelsPerWorker: faker.number.int({ min: 20, max: 50 }),
        timeLimitPerTask: faker.number.int({ min: 600, max: 1800 }),
        gracePeriod: faker.number.int({ min: 60, max: 120 }),
      },
      ...overrides,
    });
  }

  static createHighPriority(overrides: Partial<Project> = {}): Project {
    return this.create({
      taskReward: faker.number.float({ min: 1, max: 5, multipleOf: 0.01 }),
      metadata: {
        tags: ['urgent', 'high-priority'],
        requirements: {
          minAccuracy: 0.9,
          minReputation: 80,
          languages: ['en'],
          timezone: 'America/New_York',
        },
        ...overrides.metadata,
      },
      ...overrides,
    });
  }

  // For database insertion
  static createForInsert(overrides: Partial<Project> = {}): Omit<Project, 'id' | 'createdAt' | 'updatedAt'> {
    const project = this.create(overrides);
    const { id, createdAt, updatedAt, ...insertData } = project;
    return insertData;
  }
}