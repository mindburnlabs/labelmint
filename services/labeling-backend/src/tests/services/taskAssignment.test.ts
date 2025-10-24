import { TaskAssignmentService } from '../../services/taskAssignmentService';
import { PrismaClient } from '@prisma/client';
import { RedisClient } from '../../lib/redis';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../lib/redis');
jest.mock('../../utils/logger');

describe('TaskAssignmentService', () => {
  let service: TaskAssignmentService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockRedis: jest.Mocked<RedisClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockRedis = new RedisClient() as jest.Mocked<RedisClient>;
    service = new TaskAssignmentService(mockPrisma, mockRedis);
  });

  describe('getNextTask', () => {
    it('should return null if worker is not eligible', async () => {
      // Arrange
      const userId = 'worker1';
      const mockWorker = {
        accuracy: 0.5, // Below minimum
        completedTasks: 10,
        status: 'ACTIVE',
      };

      mockPrisma.worker.findUnique = jest.fn().mockResolvedValue(mockWorker);

      // Act
      const result = await service.getNextTask({ userId });

      // Assert
      expect(result).toBeNull();
      expect(mockPrisma.worker.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should return a task if worker is eligible and tasks are available', async () => {
      // Arrange
      const userId = 'worker1';
      const mockWorker = {
        accuracy: 0.9,
        completedTasks: 10,
        status: 'ACTIVE',
      };

      const mockTask = {
        id: 'task1',
        type: 'IMG_CLS',
        status: 'PENDING',
        project: {
          id: 'project1',
          status: 'RUNNING',
          budgetRemaining: 100,
          priority: 1,
        },
      };

      mockPrisma.worker.findUnique = jest.fn().mockResolvedValue(mockWorker);
      mockPrisma.task.findMany = jest.fn().mockResolvedValue([mockTask]);
      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockRedis.setex = jest.fn();
      mockRedis.del = jest.fn();
      mockPrisma.task.update = jest.fn();

      // Act
      const result = await service.getNextTask({ userId });

      // Assert
      expect(result).toEqual(mockTask);
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task1' },
        data: {
          reservedAt: expect.any(Date),
          reservedBy: userId,
        },
      });
    });

    it('should prioritize older tasks', async () => {
      // Arrange
      const userId = 'worker1';
      const mockWorker = {
        accuracy: 0.9,
        completedTasks: 10,
        status: 'ACTIVE',
      };

      const oldTask = {
        id: 'oldTask',
        type: 'IMG_CLS',
        status: 'PENDING',
        createdAt: new Date('2024-01-01'),
        project: {
          id: 'project1',
          status: 'RUNNING',
          budgetRemaining: 100,
          priority: 1,
        },
      };

      const newTask = {
        id: 'newTask',
        type: 'IMG_CLS',
        status: 'PENDING',
        createdAt: new Date('2024-01-02'),
        project: {
          id: 'project1',
          status: 'RUNNING',
          budgetRemaining: 100,
          priority: 1,
        },
      };

      mockPrisma.worker.findUnique = jest.fn().mockResolvedValue(mockWorker);
      mockPrisma.task.findMany = jest.fn().mockResolvedValue([newTask, oldTask]);
      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockRedis.setex = jest.fn();
      mockPrisma.task.update = jest.fn();

      // Act
      const result = await service.getNextTask({ userId });

      // Assert
      expect(result).toEqual(oldTask);
    });
  });

  describe('isWorkerEligible', () => {
    it('should return true for active workers with good accuracy', () => {
      // Arrange
      const worker = {
        accuracy: 0.8,
        completedTasks: 10,
        status: 'ACTIVE',
      };

      // Act & Assert
      expect((service as any).isWorkerEligible(worker)).toBe(true);
    });

    it('should return false for inactive workers', () => {
      // Arrange
      const worker = {
        accuracy: 0.9,
        completedTasks: 10,
        status: 'INACTIVE',
      };

      // Act & Assert
      expect((service as any).isWorkerEligible(worker)).toBe(false);
    });

    it('should return false for workers with low accuracy', () => {
      // Arrange
      const worker = {
        accuracy: 0.6,
        completedTasks: 10,
        status: 'ACTIVE',
      };

      // Act & Assert
      expect((service as any).isWorkerEligible(worker)).toBe(false);
    });

    it('should return false for new workers with insufficient tasks', () => {
      // Arrange
      const worker = {
        accuracy: 0.9,
        completedTasks: 2,
        status: 'ACTIVE',
      };

      // Act & Assert
      expect((service as any).isWorkerEligible(worker)).toBe(false);
    });
  });

  describe('reserveTask', () => {
    it('should reserve a task for a worker', async () => {
      // Arrange
      const taskId = 'task1';
      const userId = 'worker1';

      mockRedis.setex = jest.fn();
      mockPrisma.task.update = jest.fn();

      // Act
      await (service as any).reserveTask(taskId, userId);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `task:${taskId}:reserved`,
        30,
        expect.stringContaining(userId)
      );
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: taskId },
        data: {
          reservedAt: expect.any(Date),
          reservedBy: userId,
        },
      });
    });
  });

  describe('releaseTask', () => {
    it('should release a task reservation', async () => {
      // Arrange
      const taskId = 'task1';
      const userId = 'worker1';

      mockRedis.del = jest.fn();
      mockPrisma.task.updateMany = jest.fn();

      // Act
      await service.releaseTask(taskId, userId);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(`task:${taskId}:reserved`);
      expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
        where: {
          id: taskId,
          reservedBy: userId,
        },
        data: {
          reservedAt: null,
          reservedBy: null,
        },
      });
    });
  });

  describe('cleanupExpiredReservations', () => {
    it('should clean up expired reservations', async () => {
      // Arrange
      const expiredTask = {
        id: 'expiredTask',
        reservedAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
        status: 'PENDING',
      };

      mockPrisma.task.findMany = jest.fn().mockResolvedValue([expiredTask]);
      mockPrisma.task.updateMany = jest.fn().mockResolvedValue({ count: 1 });

      // Act
      await service.cleanupExpiredReservations();

      // Assert
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          reservedAt: {
            lt: expect.any(Date),
          },
          status: 'PENDING',
        },
      });
      expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['expiredTask'] },
        },
        data: {
          reservedAt: null,
          reservedBy: null,
        },
      });
    });
  });
});