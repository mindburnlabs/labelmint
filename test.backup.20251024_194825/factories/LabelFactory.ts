import { faker } from '@faker-js/faker';
import type { Label, LabelType } from '@shared/types/database';

export class LabelFactory {
  static create(overrides: Partial<Label> = {}): Label {
    const now = new Date();
    const id = faker.string.uuid();

    return {
      id,
      taskId: faker.string.uuid(),
      userId: faker.string.uuid(),
      value: faker.lorem.words({ min: 1, max: 3 }),
      confidence: faker.number.float({ min: 0.5, max: 1, multipleOf: 0.01 }),
      timeSpent: faker.number.int({ min: 30, max: 600 }),
      type: faker.helpers.arrayElement<LabelType>(['text', 'bounding_box', 'polygon', 'classification']),
      metadata: {
        coordinates: faker.datatype.boolean(0.3) ? {
          x: faker.number.int({ min: 0, max: 100 }),
          y: faker.number.int({ min: 0, max: 100 }),
          width: faker.number.int({ min: 10, max: 50 }),
          height: faker.number.int({ min: 10, max: 50 }),
        } : undefined,
        points: faker.datatype.boolean(0.2) ? Array.from({ length: 4 }, () => ({
          x: faker.number.int({ min: 0, max: 100 }),
          y: faker.number.int({ min: 0, max: 100 }),
        })) : undefined,
        selections: faker.datatype.boolean(0.4) ? faker.helpers.arrayElements(['option1', 'option2', 'option3']) : undefined,
        notes: faker.datatype.boolean(0.2) ? faker.lorem.sentence() : undefined,
      },
      isCorrect: faker.datatype.boolean(0.8),
      verifiedAt: faker.datatype.boolean(0.5) ? faker.date.recent({ hours: 12 }) : null,
      verifiedBy: faker.datatype.boolean(0.5) ? faker.string.uuid() : null,
      createdAt: faker.date.recent({ hours: 24 }),
      updatedAt: faker.date.recent({ hours: 1 }),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<Label> = {}): Label[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createForTask(taskId: string, overrides: Partial<Label> = {}): Label {
    return this.create({
      taskId,
      ...overrides,
    });
  }

  static createForUser(userId: string, overrides: Partial<Label> = {}): Label {
    return this.create({
      userId,
      ...overrides,
    });
  }

  static createWithConsensus(taskId: string, labels: string[], overrides: Partial<Label> = {}): Label[] {
    return labels.map((value, index) =>
      this.create({
        taskId,
        value,
        confidence: index < 2 ? faker.number.float({ min: 0.8, max: 1, multipleOf: 0.01 }) : faker.number.float({ min: 0.5, max: 0.8, multipleOf: 0.01 }),
        isCorrect: index < 2,
        verifiedAt: index < 2 ? faker.date.recent({ hours: 6 }) : null,
        ...overrides,
      })
    );
  }

  static createBoundingBox(taskId: string, bbox: { x: number; y: number; width: number; height: number }, overrides: Partial<Label> = {}): Label {
    return this.create({
      taskId,
      type: 'bounding_box',
      value: 'object',
      metadata: {
        coordinates: bbox,
        confidence: faker.number.float({ min: 0.7, max: 1, multipleOf: 0.01 }),
      },
      ...overrides,
    });
  }

  static createPolygon(taskId: string, points: Array<{ x: number; y: number }>, overrides: Partial<Label> = {}): Label {
    return this.create({
      taskId,
      type: 'polygon',
      value: 'segmentation',
      metadata: {
        points,
        confidence: faker.number.float({ min: 0.7, max: 1, multipleOf: 0.01 }),
      },
      ...overrides,
    });
  }

  static createClassification(taskId: string, classes: string[], selectedClass: string, overrides: Partial<Label> = {}): Label {
    return this.create({
      taskId,
      type: 'classification',
      value: selectedClass,
      metadata: {
        selections: [selectedClass],
        availableClasses: classes,
        confidence: faker.number.float({ min: 0.6, max: 1, multipleOf: 0.01 }),
      },
      ...overrides,
    });
  }

  static createWithHighConfidence(taskId: string, overrides: Partial<Label> = {}): Label {
    return this.create({
      taskId,
      confidence: faker.number.float({ min: 0.85, max: 1, multipleOf: 0.01 }),
      isCorrect: true,
      verifiedAt: faker.date.recent({ hours: 2 }),
      ...overrides,
    });
  }

  static createWithLowConfidence(taskId: string, overrides: Partial<Label> = {}): Label {
    return this.create({
      taskId,
      confidence: faker.number.float({ min: 0.5, max: 0.7, multipleOf: 0.01 }),
      isCorrect: faker.datatype.boolean(0.5),
      ...overrides,
    });
  }

  static createHoneypotLabel(taskId: string, expectedLabel: string, isCorrect: boolean, overrides: Partial<Label> = {}): Label {
    return this.create({
      taskId,
      value: isCorrect ? expectedLabel : faker.lorem.word(),
      isCorrect,
      confidence: isCorrect ? faker.number.float({ min: 0.9, max: 1, multipleOf: 0.01 }) : faker.number.float({ min: 0.3, max: 0.6, multipleOf: 0.01 }),
      timeSpent: isCorrect ? faker.number.int({ min: 30, max: 120 }) : faker.number.int({ min: 10, max: 60 }),
      metadata: {
        isHoneypot: true,
        expectedLabel,
        ...overrides.metadata,
      },
      ...overrides,
    });
  }

  // For database insertion
  static createForInsert(overrides: Partial<Label> = {}): Omit<Label, 'id' | 'createdAt' | 'updatedAt'> {
    const label = this.create(overrides);
    const { id, createdAt, updatedAt, ...insertData } = label;
    return insertData;
  }
}