import { ConsensusService } from '../../services/consensusService';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../utils/logger');

describe('ConsensusService', () => {
  let service: ConsensusService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    service = new ConsensusService(mockPrisma);
  });

  describe('processAnswer', () => {
    it('should require 3 answers for consensus', async () => {
      // Arrange
      const taskId = 'task1';
      const answer = 'cat';
      const workerId = 'worker1';
      const timeSpentMs = 5000;

      const mockTask = {
        id: taskId,
        type: 'IMG_CLS',
        requiredJudgments: 3,
        currentJudgments: 0,
        consensusThreshold: 2,
      };

      mockPrisma.task.findUnique = jest.fn().mockResolvedValue(mockTask);
      mockPrisma.taskAnswer.create = jest.fn().mockResolvedValue({ id: 'answer1' });
      mockPrisma.task.update = jest.fn();

      // Act
      const result = await service.processAnswer(taskId, answer, workerId, timeSpentMs);

      // Assert
      expect(result.consensusReached).toBe(false);
      expect(mockPrisma.task.update).not.toHaveBeenCalledWith({
        where: { id: taskId },
        data: { status: 'COMPLETED' },
      });
    });

    it('should reach consensus with 2 matching answers out of 2', async () => {
      // Arrange
      const taskId = 'task1';
      const answer = 'cat';
      const workerId = 'worker1';
      const timeSpentMs = 5000;

      const mockTask = {
        id: taskId,
        type: 'IMG_CLS',
        requiredJudgments: 3,
        currentJudgments: 1,
        consensusThreshold: 2,
      };

      const existingAnswers = [
        { answer: 'cat', isCorrect: null },
      ];

      mockPrisma.task.findUnique = jest.fn().mockResolvedValue(mockTask);
      mockPrisma.taskAnswer.findMany = jest.fn().mockResolvedValue(existingAnswers);
      mockPrisma.taskAnswer.create = jest.fn().mockResolvedValue({ id: 'answer2' });
      mockPrisma.task.update = jest.fn();

      // Act
      const result = await service.processAnswer(taskId, answer, workerId, timeSpentMs);

      // Assert
      expect(result.consensusReached).toBe(true);
      expect(result.finalAnswer).toBe('cat');
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: taskId },
        data: { status: 'COMPLETED' },
      });
    });

    it('should handle gold tasks with verification', async () => {
      // Arrange
      const taskId = 'task1';
      const answer = 'cat';
      const workerId = 'worker1';
      const timeSpentMs = 5000;

      const mockTask = {
        id: taskId,
        type: 'IMG_CLS',
        requiredJudgments: 1,
        currentJudgments: 0,
        consensusThreshold: 1,
        gold: true,
        goldAnswer: 'cat',
      };

      mockPrisma.task.findUnique = jest.fn().mockResolvedValue(mockTask);
      mockPrisma.taskAnswer.create = jest.fn().mockResolvedValue({ id: 'answer1' });
      mockPrisma.task.update = jest.fn();
      mockPrisma.worker.update = jest.fn();

      // Act
      const result = await service.processAnswer(taskId, answer, workerId, timeSpentMs);

      // Assert
      expect(result.consensusReached).toBe(true);
      expect(result.isCorrect).toBe(true);
      expect(mockPrisma.worker.update).toHaveBeenCalledWith({
        where: { userId: workerId },
        data: {
          accuracy: expect.any(Number),
          totalXp: expect.any(Number),
        },
      });
    });
  });

  describe('calculateAccuracy', () => {
    it('should calculate accuracy correctly', () => {
      // Arrange
      const answers = [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: false },
      ];

      // Act
      const accuracy = (service as any).calculateAccuracy(answers);

      // Assert
      expect(accuracy).toBe(0.6); // 3 correct out of 5
    });

    it('should return 0 for no answers', () => {
      // Arrange
      const answers = [];

      // Act
      const accuracy = (service as any).calculateAccuracy(answers);

      // Assert
      expect(accuracy).toBe(0);
    });
  });

  describe('calculateIoU', () => {
    it('should calculate Intersection over Union correctly', () => {
      // Arrange
      const box1 = { x: 0, y: 0, width: 100, height: 100 };
      const box2 = { x: 50, y: 50, width: 100, height: 100 };

      // Act
      const iou = (service as any).calculateIoU(box1, box2);

      // Assert
      // Intersection: 50x50 = 2500
      // Union: 10000 + 10000 - 2500 = 17500
      // IoU: 2500 / 17500 = 0.1429
      expect(iou).toBeCloseTo(0.1429, 4);
    });

    it('should return 0 for non-overlapping boxes', () => {
      // Arrange
      const box1 = { x: 0, y: 0, width: 100, height: 100 };
      const box2 = { x: 200, y: 200, width: 100, height: 100 };

      // Act
      const iou = (service as any).calculateIoU(box1, box2);

      // Assert
      expect(iou).toBe(0);
    });

    it('should return 1 for identical boxes', () => {
      // Arrange
      const box1 = { x: 0, y: 0, width: 100, height: 100 };
      const box2 = { x: 0, y: 0, width: 100, height: 100 };

      // Act
      const iou = (service as any).calculateIoU(box1, box2);

      // Assert
      expect(iou).toBe(1);
    });
  });

  describe('checkConsensus', () => {
    it('should detect consensus when threshold is met', () => {
      // Arrange
      const answers = [
        { answer: 'cat', count: 2 },
        { answer: 'dog', count: 1 },
      ];
      const threshold = 2;

      // Act
      const result = (service as any).checkConsensus(answers, threshold);

      // Assert
      expect(result.hasConsensus).toBe(true);
      expect(result.consensusAnswer).toBe('cat');
    });

    it('should not detect consensus when threshold is not met', () => {
      // Arrange
      const answers = [
        { answer: 'cat', count: 1 },
        { answer: 'dog', count: 1 },
        { answer: 'bird', count: 1 },
      ];
      const threshold = 2;

      // Act
      const result = (service as any).checkConsensus(answers, threshold);

      // Assert
      expect(result.hasConsensus).toBe(false);
      expect(result.consensusAnswer).toBeNull();
    });
  });
});