import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { CacheManager } from '../cache/cache-manager';
import { MetricsCollector } from '../utils/metrics';
import { validateBulkOperation } from '../validators/bulk-validator';
import { QueueService } from '../services/queue';

interface BulkOperation<T> {
  operation: 'create' | 'update' | 'delete';
  data?: T;
  id?: string;
  conditions?: any;
}

interface BulkResult<T> {
  successful: number;
  failed: number;
  errors: Array<{ index: number; error: string; data?: any }>;
  results: T[];
  operationId: string;
  duration: number;
}

interface BulkCreateRequest<T> {
  data: T[];
  validateEach?: boolean;
  continueOnError?: boolean;
  batchSize?: number;
}

interface BulkUpdateRequest<T> {
  updates: Array<{ id: string; data: Partial<T> }>;
  conditions?: any;
  validateEach?: boolean;
  continueOnError?: boolean;
}

interface BulkDeleteRequest {
  ids: string[];
  conditions?: any;
  softDelete?: boolean;
  validateEach?: boolean;
  continueOnError?: boolean;
}

export class BulkOperationsRouter {
  private router: Router;
  private logger: Logger;
  private prisma: PrismaClient;
  private cache: CacheManager;
  private metrics: MetricsCollector;
  private queue: QueueService;

  constructor(
    prisma: PrismaClient,
    cache: CacheManager,
    queue: QueueService
  ) {
    this.router = Router();
    this.logger = new Logger('BulkOperations');
    this.prisma = prisma;
    this.cache = cache;
    this.metrics = new MetricsCollector('bulk_operations');
    this.queue = queue;

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Bulk create operations
    this.router.post('/users', this.bulkCreateUsers.bind(this));
    this.router.post('/tasks', this.bulkCreateTasks.bind(this));
    this.router.post('/projects', this.bulkCreateProjects.bind(this));
    this.router.post('/comments', this.bulkCreateComments.bind(this));

    // Bulk update operations
    this.router.patch('/users', this.bulkUpdateUsers.bind(this));
    this.router.patch('/tasks', this.bulkUpdateTasks.bind(this));
    this.router.patch('/projects', this.bulkUpdateProjects.bind(this));
    this.router.patch('/comments', this.bulkUpdateComments.bind(this));

    // Bulk delete operations
    this.router.delete('/users', this.bulkDeleteUsers.bind(this));
    this.router.delete('/tasks', this.bulkDeleteTasks.bind(this));
    this.router.delete('/projects', this.bulkDeleteProjects.bind(this));
    this.router.delete('/comments', this.bulkDeleteComments.bind(this));

    // Bulk custom operations
    this.router.post('/tasks/assign', this.bulkAssignTasks.bind(this));
    this.router.post('/delegations/create', this.bulkCreateDelegations.bind(this));
    this.router.post('/notifications/send', this.bulkSendNotifications.bind(this));

    // Bulk operation status
    this.router.get('/status/:operationId', this.getOperationStatus.bind(this));
  }

  /**
   * Bulk create users
   */
  private async bulkCreateUsers(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const operationId = `bulk_create_users_${Date.now()}`;

    try {
      const request: BulkCreateRequest<any> = req.body;
      const { data, validateEach = true, continueOnError = false, batchSize = 100 } = request;

      if (!data || !Array.isArray(data) || data.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid data array'
        });
        return;
      }

      if (data.length > 1000) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot create more than 1000 users in a single request'
        });
        return;
      }

      const results: any[] = [];
      const errors: Array<{ index: number; error: string; data?: any }> = [];
      let successful = 0;
      let failed = 0;

      // Process in batches
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        for (let j = 0; j < batch.length; j++) {
          const user = batch[j];
          const globalIndex = i + j;

          try {
            // Validate if required
            if (validateEach) {
              const validation = await validateBulkOperation('user', 'create', user);
              if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
              }
            }

            // Check for existing email
            const existingUser = await this.prisma.user.findUnique({
              where: { email: user.email }
            });

            if (existingUser) {
              throw new Error(`User with email ${user.email} already exists`);
            }

            // Create user
            const createdUser = await this.prisma.user.create({
              data: {
                ...user,
                id: undefined // Let database generate ID
              },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                createdAt: true
              }
            });

            results.push(createdUser);
            successful++;

            // Cache the new user
            await this.cache.set(`user:${createdUser.id}`, createdUser, {
              ttl: 3600,
              tags: ['user', 'bulk_operation']
            });

          } catch (error) {
            failed++;
            errors.push({
              index: globalIndex,
              error: error instanceof Error ? error.message : 'Unknown error',
              data: user
            });

            this.logger.error(`Bulk create user failed at index ${globalIndex}`, error);

            if (!continueOnError) {
              throw error;
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      const result: BulkResult<any> = {
        successful,
        failed,
        errors,
        results,
        operationId,
        duration
      };

      // Record metrics
      this.metrics.histogram('bulk_create_duration', duration, { entity: 'users' });
      this.metrics.increment('bulk_create_operations', { entity: 'users' });
      this.metrics.gauge('bulk_create_success_rate', (successful / data.length) * 100, { entity: 'users' });

      // Invalidate user list cache
      await this.cache.deleteByPattern('user:list:*');

      res.json(result);

    } catch (error) {
      this.logger.error('Bulk create users error', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create users',
        operationId
      });
    }
  }

  /**
   * Bulk create tasks
   */
  private async bulkCreateTasks(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const operationId = `bulk_create_tasks_${Date.now()}`;

    try {
      const request: BulkCreateRequest<any> = req.body;
      const { data, validateEach = true, continueOnError = false, batchSize = 100 } = request;

      if (!data || !Array.isArray(data) || data.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid data array'
        });
        return;
      }

      const results: any[] = [];
      const errors: Array<{ index: number; error: string; data?: any }> = [];
      let successful = 0;
      let failed = 0;

      // Validate all IDs first
      if (validateEach) {
        const userIds = [...new Set(data.map(task => task.assigneeId).filter(Boolean))];
        const projectIds = [...new Set(data.map(task => task.projectId).filter(Boolean))];

        const [existingUsers, existingProjects] = await Promise.all([
          userIds.length > 0 ?
            this.prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true }
            }) : [],
          projectIds.length > 0 ?
            this.prisma.project.findMany({
              where: { id: { in: projectIds } },
              select: { id: true }
            }) : []
        ]);

        const existingUserIds = new Set(existingUsers.map(u => u.id));
        const existingProjectIds = new Set(existingProjects.map(p => p.id));

        data.forEach((task, index) => {
          if (task.assigneeId && !existingUserIds.has(task.assigneeId)) {
            throw new Error(`Assignee ID ${task.assigneeId} not found for task at index ${index}`);
          }
          if (task.projectId && !existingProjectIds.has(task.projectId)) {
            throw new Error(`Project ID ${task.projectId} not found for task at index ${index}`);
          }
        });
      }

      // Process in batches
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        for (let j = 0; j < batch.length; j++) {
          const task = batch[j];
          const globalIndex = i + j;

          try {
            const createdTask = await this.prisma.task.create({
              data: {
                title: task.title,
                description: task.description,
                status: task.status || 'todo',
                priority: task.priority || 'medium',
                assigneeId: task.assigneeId,
                creatorId: req.user?.id,
                projectId: task.projectId,
                dueDate: task.dueDate ? new Date(task.dueDate) : null,
                tags: task.tags || []
              },
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                assigneeId: true,
                projectId: true,
                dueDate: true,
                createdAt: true
              }
            });

            results.push(createdTask);
            successful++;

            // Cache the new task
            await this.cache.set(`task:${createdTask.id}`, createdTask, {
              ttl: 1800,
              tags: ['task', 'bulk_operation']
            });

          } catch (error) {
            failed++;
            errors.push({
              index: globalIndex,
              error: error instanceof Error ? error.message : 'Unknown error',
              data: task
            });

            if (!continueOnError) {
              throw error;
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      const result: BulkResult<any> = {
        successful,
        failed,
        errors,
        results,
        operationId,
        duration
      };

      // Record metrics
      this.metrics.histogram('bulk_create_duration', duration, { entity: 'tasks' });
      this.metrics.increment('bulk_create_operations', { entity: 'tasks' });

      // Invalidate task cache
      await this.cache.deleteByPattern('task:*');

      res.json(result);

    } catch (error) {
      this.logger.error('Bulk create tasks error', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create tasks',
        operationId
      });
    }
  }

  /**
   * Bulk update users
   */
  private async bulkUpdateUsers(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const operationId = `bulk_update_users_${Date.now()}`;

    try {
      const request: BulkUpdateRequest<any> = req.body;
      const { updates, validateEach = true, continueOnError = false } = request;

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid updates array'
        });
        return;
      }

      const results: any[] = [];
      const errors: Array<{ index: number; error: string; data?: any }> = [];
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < updates.length; i++) {
        const { id, data } = updates[i];

        try {
          if (!id) {
            throw new Error('ID is required for update operation');
          }

          // Validate if required
          if (validateEach) {
            const validation = await validateBulkOperation('user', 'update', data);
            if (!validation.valid) {
              throw new Error(validation.errors.join(', '));
            }
          }

          const updatedUser = await this.prisma.user.update({
            where: { id },
            data: {
              ...data,
              updatedAt: new Date()
            },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              status: true,
              updatedAt: true
            }
          });

          results.push(updatedUser);
          successful++;

          // Update cache
          await this.cache.set(`user:${id}`, updatedUser, {
            ttl: 3600,
            tags: ['user', 'bulk_operation']
          });

        } catch (error) {
          failed++;
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: updates[i]
          });

          if (!continueOnError) {
            throw error;
          }
        }
      }

      const duration = Date.now() - startTime;
      const result: BulkResult<any> = {
        successful,
        failed,
        errors,
        results,
        operationId,
        duration
      };

      // Record metrics
      this.metrics.histogram('bulk_update_duration', duration, { entity: 'users' });

      // Invalidate cache
      await this.cache.deleteByPattern('user:*');

      res.json(result);

    } catch (error) {
      this.logger.error('Bulk update users error', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update users',
        operationId
      });
    }
  }

  /**
   * Bulk delete tasks (soft delete)
   */
  private async bulkDeleteTasks(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const operationId = `bulk_delete_tasks_${Date.now()}`;

    try {
      const request: BulkDeleteRequest = req.body;
      const { ids, softDelete = true, validateEach = true, continueOnError = false } = request;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid IDs array'
        });
        return;
      }

      const results: any[] = [];
      const errors: Array<{ index: number; error: string; data?: any }> = [];
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];

        try {
          if (softDelete) {
            await this.prisma.task.update({
              where: { id },
              data: { deletedAt: new Date() }
            });
          } else {
            await this.prisma.task.delete({
              where: { id }
            });
          }

          results.push({ id, deleted: true });
          successful++;

          // Remove from cache
          await this.cache.delete(`task:${id}`);

        } catch (error) {
          failed++;
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: { id }
          });

          if (!continueOnError) {
            throw error;
          }
        }
      }

      const duration = Date.now() - startTime;
      const result: BulkResult<any> = {
        successful,
        failed,
        errors,
        results,
        operationId,
        duration
      };

      // Record metrics
      this.metrics.histogram('bulk_delete_duration', duration, { entity: 'tasks' });

      // Invalidate cache
      await this.cache.deleteByPattern('task:*');

      res.json(result);

    } catch (error) {
      this.logger.error('Bulk delete tasks error', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete tasks',
        operationId
      });
    }
  }

  /**
   * Bulk assign tasks
   */
  private async bulkAssignTasks(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const operationId = `bulk_assign_tasks_${Date.now()}`;

    try {
      const { taskIds, assigneeId, notify = false } = req.body;

      if (!taskIds || !Array.isArray(taskIds) || !assigneeId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'taskIds array and assigneeId are required'
        });
        return;
      }

      // Validate assignee exists
      const assignee = await this.prisma.user.findUnique({
        where: { id: assigneeId }
      });

      if (!assignee) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Assignee not found'
        });
        return;
      }

      const results = await this.prisma.task.updateMany({
        where: {
          id: { in: taskIds },
          deletedAt: null
        },
        data: {
          assigneeId,
          updatedAt: new Date()
        }
      });

      // Create notifications if requested
      if (notify && results.count > 0) {
        await this.queue.addBulk('notifications', taskIds.map(taskId => ({
          type: 'task_assigned',
          userId: assigneeId,
          data: { taskId }
        })));
      }

      // Clear cache
      await this.cache.deleteByPattern('task:*');
      await this.cache.delete(`user:${assigneeId}:tasks`);

      const duration = Date.now() - startTime;

      res.json({
        successful: results.count,
        failed: taskIds.length - results.count,
        operationId,
        duration,
        message: `Assigned ${results.count} tasks to ${assignee.name}`
      });

    } catch (error) {
      this.logger.error('Bulk assign tasks error', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to assign tasks',
        operationId
      });
    }
  }

  /**
   * Get bulk operation status
   */
  private async getOperationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { operationId } = req.params;

      // Get operation status from cache
      const status = await this.cache.get(`bulk_operation:${operationId}`);

      if (!status) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Operation not found'
        });
        return;
      }

      res.json(status);

    } catch (error) {
      this.logger.error('Get operation status error', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get operation status'
      });
    }
  }

  /**
   * Placeholder methods for other bulk operations
   */
  private async bulkCreateProjects(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not Implemented' });
  }

  private async bulkCreateComments(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not Implemented' });
  }

  private async bulkUpdateTasks(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not Implemented' });
  }

  private async bulkUpdateProjects(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not Implemented' });
  }

  private async bulkUpdateComments(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not Implemented' });
  }

  private async bulkDeleteUsers(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not Implemented' });
  }

  private async bulkDeleteProjects(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not Implemented' });
  }

  private async bulkDeleteComments(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not Implemented' });
  }

  private async bulkCreateDelegations(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not Implemented' });
  }

  private async bulkSendNotifications(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not Implemented' });
  }

  /**
   * Get router instance
   */
  getRouter(): Router {
    return this.router;
  }
}

export default BulkOperationsRouter;