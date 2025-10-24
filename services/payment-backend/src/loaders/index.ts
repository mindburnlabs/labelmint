import { Loader } from 'dataloader';
import { Logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { DataLoaderManager, DataLoaderConfig } from '../config/dataloader';

const logger = new Logger('DataLoaders');

// Base class for all DataLoaders
abstract class BaseLoader {
  protected prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  protected async batchLoad<T>(
    ids: string[],
    field: string,
    model: string,
    options: {
      transform?: (data: any) => T;
      where?: any;
      include?: any;
      orderBy?: any;
    } = {}
  ): Promise<T[]> {
    if (ids.length === 0) return [];

    const where = {
      [field]: {
        in: ids
      },
      ...options.where
    };

    const include = options.include || {};
    const orderBy = options.orderBy || { [field]: 'asc' };

    try {
      const records = await this.prisma[model].findMany({
        where,
        include,
        orderBy
      });

      return records.map(record =>
        options.transform ? options.transform(record) : record as T
      );
    } catch (error) {
      logger.error(`Batch load failed for ${model}`, error);
      throw error;
    }
  }
}

// User DataLoaders
export class UserLoaders {
  private manager: DataLoaderManager;
  private loaders: Map<string, any> = new Map();

  constructor(manager: DataLoaderManager, prisma: PrismaClient) {
    this.manager = manager;
    super(prisma);
  }

  // Basic user loader
  private get basicUserLoader(): any {
    if (!this.loaders.has('basic')) {
      this.loaders.set('basic', new DataLoader<string, any>(
        keys => this.batchLoad(keys, 'id', 'User'),
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('basic');
  }

  // User with profile loader
  private get userWithProfileLoader(): any {
    if (!this.loaders.has('withProfile')) {
      this.loaders.set('withProfile', new DataLoader<string, any>(
        keys => this.batchLoad(
          keys,
          'id',
          'User',
          {
            include: {
              profile: true,
              roles: true
            }
          }
        ),
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('withProfile');
  }

  // User by email loader
  private get userByEmailLoader(): any {
    if (!this.loaders.has('byEmail')) {
      this.loaders.set('byEmail', new DataLoader<string, any>(
        keys => this.batchLoad(
          keys,
          'email',
          'User',
          {
            where: { email: { in: keys } },
            include: {
              profile: true,
              roles: true
            }
          }
        ),
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byEmail');
  }

  // Users by role loader
  private get usersByRoleLoader(): any {
    if (!this.loaders.has('byRole')) {
      this.loaders.set('byRole', new DataLoader<string, any>(
        keys => {
          // Find users with specified roles
          const users = await this.prisma.user.findMany({
            where: {
              roles: {
                some: {
                  name: { in: keys }
                }
              }
            },
            select: { id: true, role_id: true }
          });

          return users.map(user => user.id);
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byRole');
  }

  // Get all loaders for cleanup
  public getAllLoaders(): any[] {
    return Array.from(this.loaders.values());
  }

  public async clearCache(loaderName?: string): Promise<void> {
    if (loaderName) {
      const loader = this.loaders.get(loaderName);
      if (loader && typeof loader.clearAll === 'function') {
        await loader.clearAll();
      }
    } else {
      await this.manager.clearAllCaches();
    }
  }
}

// Task DataLoaders
export class TaskLoaders {
  private manager: DataLoaderManager;
  private loaders: Map<string, any> = new Map();

  constructor(manager: DataLoaderManager, prisma: PrismaClient) {
    this.manager = manager;
    super(prisma);
  }

  // Task by ID loader
  private get taskByIdLoader(): any {
    if (!this.loaders.has('byId')) {
      this.loaders.set('byId', new DataLoader<string, any>(
        keys => this.batchLoad(
          keys,
          'id',
          'Task',
          {
            include: {
              assignee: true,
              creator: true,
              project: true,
              tags: true
            },
            where: {
              id: { in: keys },
              deletedAt: null
            }
          }
        ),
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byId');
  }

  // Tasks by assignee loader
  private get tasksByAssigneeLoader(): any {
    if (!this.loaders.has('byAssignee')) {
      this.loaders.set('byAssignee', new DataLoader<string, any>(
        keys => {
          const tasks = await this.prisma.task.findMany({
            where: {
              assigneeId: { in: keys },
              deletedAt: null
            },
            select: { id: true }
          });

          return tasks.map(task => task.id);
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byAssignee');
  }

  // Tasks by project loader
  private get tasksByProjectLoader(): any {
    if (!this.loaders.has('byProject')) {
      this.loaders.set('byProject', new DataLoader<string, any>(
        keys => {
          const projects = await this.prisma.project.findMany({
            where: {
              id: { in: keys },
              deletedAt: null
            },
            select: { id: true }
          });

          return projects.map(project => project.id);
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byProject');
  }

  // Tasks by status loader
  private get tasksByStatusLoader(): any {
    if (!this.loaders.has('byStatus')) {
      this.loaders.set('byStatus', new DataLoader<string, any>(
        keys => {
          const tasks = await this.prisma.task.findMany({
            where: {
              status: { in: keys },
              deletedAt: null
            },
            select: { id: true }
          });

          return tasks.map(task => task.id);
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byStatus');
  }

  // All tasks for a user
  private get tasksByUserLoader(): any {
    if (!this.loaders.has('byUser')) {
      this.loaders.set('byUser', new DataLoader<string, any>(
        keys => {
          const tasks = await this.prisma.task.findMany({
            where: {
              assigneeId: keys[0], // Pass array with single user ID
              deletedAt: null
            },
            select: { id: true }
          });

          return tasks.map(task => task.id);
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byUser');
  }

  // Recent tasks loader (time-based)
  private get recentTasksLoader(): any {
    if (!this.loaders.has('recent')) {
      this.loaders.set('recent', new DataLoader<string, any>(
        keys => {
          // Get recent tasks from the last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const tasks = await this.prisma.task.findMany({
            where: {
              createdAt: {
                gte: sevenDaysAgo
              },
              deletedAt: null
            },
            select: { id: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
          });

          return tasks.map(task => task.id);
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('recent');
  }
}

// Delegate DataLoaders
export class DelegateLoaders {
  private manager: DataLoaderManager;
  private loaders: Map<string, any> = new Map();

  constructor(manager: DataLoaderManager, prisma: PrismaClient) {
    this.manager = manager;
    super(prisma);
  }

  // Delegation by ID loader
  private get delegationByIdLoader(): any {
    if (!this.loaders.has('byId')) {
      this.loaders.set('byId', new DataLoader<string, any>(
        keys => this.batchLoad(
          keys,
          'id',
          'Delegation',
          {
            include: {
              delegator: true,
              delegatee: true,
              task: {
                assignee: true,
                project: true
              }
            }
          }
        ),
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byId');
  }

  // Delegations by delegator
  private get delegationsByDelegatorLoader(): any {
    if (!this.loaders.has('byDelegator')) {
      this.loaders.set('byDelegator', new DataLoader<string, any>(
        keys => {
          const delegations = await this.prisma.delegation.findMany({
            where: {
              delegatorId: { in: keys },
              deletedAt: null
            },
            select: { id: true }
          });

          return delegations.map(delegation => delegation.id);
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byDelegator');
  }

  // Delegations by status
  private get delegationsByStatusLoader(): any {
    if (!this.loaders.has('byStatus')) {
      this.loaders.set('byStatus', new DataLoader<string, any>(
        keys => {
          const delegations = await this.prisma.delegation.findMany({
            where: {
              status: { in: keys },
              deletedAt: null
            },
            select: { id: true }
          });

          return delegations.map(delegation => delegation.id);
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byStatus');
  }
}

// Comment DataLoaders
export class CommentLoaders {
  private manager: DataLoaderManager;
  private loaders: Map<string, any> = new Map();

  constructor(manager: DataLoaderManager, prisma: PrismaClient) {
    this.manager = manager;
    super(prisma);
  }

  // Comment by ID loader
  private get commentByIdLoader(): any {
    if (!this.loaders.has('byId')) {
      this.loaders.set('byId', new DataLoader<string, any>(
        keys => this.batchLoad(
          keys,
          'id',
          'Comment',
          {
            include: {
              author: true,
              user: true,
              task: true,
              parent: true,
              replies: {
                include: {
                  author: true,
                  user: true
                }
              }
            },
            where: {
              deletedAt: null
            }
          }
        ),
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byId');
  }

  // Comments by task loader
  private get commentsByTaskLoader(): any {
    if (!this.loaders.has('byTask')) {
      this.loaders.set('byTask', new DataLoader<string, any>(
        keys => {
          const comments = await this.prisma.comment.findMany({
            where: {
              taskId: { in: keys },
              deletedAt: null
            },
            select: { id: true },
            orderBy: { createdAt: 'asc' }
          });

          return comments.map(comment => comment.id);
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('byTask');
  }

  // Comments with replies
  private get commentsWithRepliesLoader(): any {
    if (!this.loaders.has('withReplies')) {
      this.loaders.set('withReplies', new DataLoader<string, any>(
        async keys => {
          const comments = await this.prisma.comment.findMany({
            where: {
              id: { in: keys },
              deletedAt: null
            },
            select: { id: true },
            include: {
              replies: {
                include: {
                  author: true,
                  user: true
                }
              }
            }
          });

          return keys.map(key => comments.find(c => c.id === key));
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('withReplies');
  }

// Analytics DataLoaders
export class AnalyticsLoaders extends BaseLoader {
  private manager: DataLoaderManager;
  private loaders: Map<string, any> = new Map();

  constructor(manager: DataLoaderManager, prisma: PrismaClient) {
    super(prisma);
    this.manager = manager;
  }

  // Task analytics by time period
  private get taskStatsByPeriodLoader(): any {
    if (!this.loaders.has('taskStatsByPeriod')) {
      this.loaders.set('taskStatsByPeriod', new DataLoader<string, any>(
        async periods => {
          // This would be replaced with actual aggregation queries
          // For now, return mock data
          return periods.map(period => ({
            period,
            total: Math.floor(Math.random() * 100),
            completed: Math.floor(Math.random() * 80),
            pending: Math.floor(Math.random() * 20)
          }));
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('taskStatsByPeriod');
  }

  // User activity analytics
  private getUserActivityLoader(): any {
    if (!this.loaders.has('userActivity')) {
      this.loaders.set('userActivity', new DataLoader<string, any>(
        async periods => {
          // This would be replaced with actual user activity queries
          return periods.map(period => ({
            period,
            activeUsers: Math.floor(Math.random() * 1000) + 100,
            newUsers: Math.floor(Math.random() * 50) + 10,
            pageViews: Math.floor(Math.random() * 10000) + 500
          }));
        },
        DataLoaderConfig.READ_HEAVY
      ));
    }
    return this.loaders.get('userActivity');
  }
}

export default {
  UserLoaders,
  TaskLoaders,
  DelegateLoaders,
  CommentLoaders,
  AnalyticsLoaders
};