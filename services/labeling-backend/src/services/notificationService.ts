import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { PrismaClient, User, Task, Project, Worker } from '@prisma/client';
import { RedisClient } from '@/lib/redis';
import { logger } from '@/utils/logger';
import jwt from 'jsonwebtoken';
import { authenticateSocket } from '@/middleware/socketAuth';

interface NotificationData {
  type: 'task_assigned' | 'task_completed' | 'project_update' | 'payment_received' | 'withdrawal_processed' | 'system_message';
  userId: string;
  data: any;
  timestamp: Date;
}

interface ConnectedUser {
  userId: string;
  socketId: string;
  role: string;
  connectedAt: Date;
}

export class NotificationService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, ConnectedUser> = new Map();

  constructor(
    private prisma: PrismaClient,
    private redis: RedisClient,
    private jwtSecret: string
  ) {
    this.io = new SocketIOServer({
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server: HTTPServer): void {
    this.io.attach(server);

    // Authentication middleware
    this.io.use(authenticateSocket(this.jwtSecret));

    this.io.on('connection', (socket) => {
      const user = socket.data.user as User;
      logger.info(`User connected: ${user.id} (${user.email})`);

      // Track connected user
      const connectedUser: ConnectedUser = {
        userId: user.id,
        socketId: socket.id,
        role: user.role,
        connectedAt: new Date(),
      };
      this.connectedUsers.set(user.id, connectedUser);

      // Join user to their personal room
      socket.join(`user:${user.id}`);

      // Join admin users to admin room
      if (user.role === 'ADMIN') {
        socket.join('admin');
      }

      // Join workers to worker room
      if (user.role === 'WORKER') {
        socket.join('workers');
        this.handleWorkerEvents(socket, user.id);
      }

      // Handle project owner events
      this.handleProjectOwnerEvents(socket, user.id);

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`User disconnected: ${user.id}`);
        this.connectedUsers.delete(user.id);
      });

      // Handle custom events
      socket.on('mark_notification_read', async (notificationId) => {
        await this.markNotificationRead(notificationId, user.id);
      });

      socket.on('get_notifications', async () => {
        const notifications = await this.getUserNotifications(user.id);
        socket.emit('notifications', notifications);
      });

      socket.on('subscribe_project', (projectId: string) => {
        socket.join(`project:${projectId}`);
      });

      socket.on('unsubscribe_project', (projectId: string) => {
        socket.leave(`project:${projectId}`);
      });

      // Send unread notifications on connection
      this.sendUnreadNotifications(user.id);
    });

    logger.info('WebSocket notification service initialized');
  }

  /**
   * Handle worker-specific events
   */
  private handleWorkerEvents(socket: any, userId: string): void {
    // Listen for task availability requests
    socket.on('request_task', async () => {
      try {
        const taskAssignmentService = require('./taskAssignmentService').default;
        const task = await taskAssignmentService.getNextTask({ userId });

        if (task) {
          socket.emit('task_available', task);
        } else {
          socket.emit('no_tasks_available');
        }
      } catch (error) {
        logger.error('Error handling task request', error);
        socket.emit('error', { message: 'Failed to get task' });
      }
    });

    // Listen for task submissions
    socket.on('task_submit', async (data) => {
      try {
        const { taskId, answer, timeSpentMs } = data;

        // Process submission
        const result = await this.processTaskSubmission(userId, taskId, answer, timeSpentMs);

        socket.emit('task_submitted', result);

        // Notify project owner
        await this.notifyProjectOwner(taskId, 'task_completed', {
          taskId,
          workerId: userId,
          result,
        });
      } catch (error) {
        logger.error('Error processing task submission', error);
        socket.emit('error', { message: 'Failed to submit task' });
      }
    });
  }

  /**
   * Handle project owner events
   */
  private handleProjectOwnerEvents(socket: any, userId: string): void {
    // Listen for project status changes
    socket.on('project_status_change', async (data) => {
      const { projectId, status } = data;

      // Notify all workers
      this.io.to('workers').emit('project_update', {
        projectId,
        status,
        timestamp: new Date(),
      });
    });
  }

  /**
   * Send notification to specific user
   */
  async sendNotification(
    userId: string,
    type: NotificationData['type'],
    data: any,
    saveToDatabase: boolean = true
  ): Promise<void> {
    const notification: NotificationData = {
      type,
      userId,
      data,
      timestamp: new Date(),
    };

    // Send real-time notification
    this.io.to(`user:${userId}`).emit('notification', notification);

    // Save to database if requested
    if (saveToDatabase) {
      await this.saveNotification(notification);
    }

    logger.debug('Notification sent', { userId, type });
  }

  /**
   * Send notification to all admins
   */
  async notifyAdmins(type: string, data: any): Promise<void> {
    this.io.to('admin').emit('admin_notification', {
      type,
      data,
      timestamp: new Date(),
    });

    logger.info('Admin notification sent', { type });
  }

  /**
   * Send notification to all workers
   */
  async notifyWorkers(type: string, data: any): Promise<void> {
    this.io.to('workers').emit('worker_notification', {
      type,
      data,
      timestamp: new Date(),
    });

    logger.info('Worker notification sent', { type });
  }

  /**
   * Notify project owner about project events
   */
  async notifyProjectOwner(taskId: string, eventType: string, data: any): Promise<void> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: {
          project: {
            select: { ownerId: true },
          },
        },
      });

      if (task?.project.ownerId) {
        await this.sendNotification(task.project.ownerId, eventType as NotificationData['type'], data);
      }
    } catch (error) {
      logger.error('Failed to notify project owner', error);
    }
  }

  /**
   * Broadcast system message
   */
  async broadcastSystemMessage(message: string, severity: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    const notification = {
      type: 'system_message' as const,
      data: {
        message,
        severity,
      },
      timestamp: new Date(),
    };

    this.io.emit('system_message', notification);

    // Save system message to all users
    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    for (const user of users) {
      await this.saveNotification({
        ...notification,
        userId: user.id,
      });
    }

    logger.info('System message broadcasted', { message, severity });
  }

  /**
   * Save notification to database
   */
  private async saveNotification(notification: NotificationData): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: notification.userId,
          type: notification.type,
          data: notification.data,
          isRead: false,
        },
      });
    } catch (error) {
      logger.error('Failed to save notification', error);
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const notifications = await this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return notifications;
    } catch (error) {
      logger.error('Failed to get user notifications', error);
      return [];
    }
  }

  /**
   * Send unread notifications to user
   */
  private async sendUnreadNotifications(userId: string): Promise<void> {
    try {
      const unreadNotifications = await this.prisma.notification.findMany({
        where: {
          userId,
          isRead: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      if (unreadNotifications.length > 0) {
        this.io.to(`user:${userId}`).emit('unread_notifications', unreadNotifications);
      }
    } catch (error) {
      logger.error('Failed to send unread notifications', error);
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    try {
      await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to mark notification as read', error);
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllNotificationsRead(userId: string): Promise<void> {
    try {
      await this.prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      // Send confirmation
      this.io.to(`user:${userId}`).emit('all_notifications_read');
    } catch (error) {
      logger.error('Failed to mark all notifications as read', error);
    }
  }

  /**
   * Process task submission
   */
  private async processTaskSubmission(
    userId: string,
    taskId: string,
    answer: any,
    timeSpentMs: number
  ): Promise<any> {
    // This would integrate with the task processing logic
    // For now, return a mock result
    return {
      success: true,
      isCorrect: Math.random() > 0.3, // 70% accuracy mock
      earnings: Math.random() * 0.1, // Random earnings
      nextTaskAvailable: Math.random() > 0.5,
    };
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): { total: number; workers: number; admins: number } {
    let workers = 0;
    let admins = 0;

    for (const user of this.connectedUsers.values()) {
      if (user.role === 'WORKER') workers++;
      if (user.role === 'ADMIN') admins++;
    }

    return {
      total: this.connectedUsers.size,
      workers,
      admins,
    };
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<any> {
    const connectedUsers = this.getConnectedUsersCount();

    // Get task statistics
    const [pendingTasks, activeTasks, completedToday] = await Promise.all([
      this.prisma.task.count({ where: { status: 'PENDING' } }),
      this.prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.task.count({
        where: {
          status: 'COMPLETED',
          updatedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    // Get worker statistics
    const activeWorkers = await this.prisma.worker.count({
      where: {
        status: 'ACTIVE',
        lastActiveAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
    });

    return {
      connectedUsers,
      tasks: {
        pending: pendingTasks,
        active: activeTasks,
        completedToday,
      },
      activeWorkers,
      timestamp: new Date(),
    };
  }

  /**
   * Emit real-time metrics to admins
   */
  async emitRealTimeMetrics(): Promise<void> {
    const metrics = await this.getRealTimeMetrics();
    this.io.to('admin').emit('real_time_metrics', metrics);
  }

  /**
   * Handle payment notifications
   */
  async handlePaymentNotification(
    userId: string,
    type: 'deposit' | 'withdrawal',
    amount: number,
    status: string,
    transactionId?: string
  ): Promise<void> {
    const notificationType = type === 'deposit' ? 'payment_received' : 'withdrawal_processed';

    await this.sendNotification(userId, notificationType, {
      amount,
      status,
      transactionId,
      type,
    });
  }

  /**
   * Handle task assignment notifications
   */
  async handleTaskAssignment(userId: string, task: Task): Promise<void> {
    await this.sendNotification(userId, 'task_assigned', {
      taskId: task.id,
      taskType: task.type,
      projectId: task.projectId,
      timeLimit: 30, // seconds
    });
  }

  /**
   * Schedule periodic notifications
   */
  async startPeriodicUpdates(): Promise<void> {
    // Emit real-time metrics to admins every 5 seconds
    setInterval(async () => {
      await this.emitRealTimeMetrics();
    }, 5000);

    // Check for inactive tasks every minute
    setInterval(async () => {
      await this.checkForInactiveTasks();
    }, 60000);

    // Clean up old notifications every hour
    setInterval(async () => {
      await this.cleanupOldNotifications();
    }, 3600000);
  }

  /**
   * Check for inactive tasks and notify
   */
  private async checkForInactiveTasks(): Promise<void> {
    const inactiveThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    const inactiveTasks = await this.prisma.task.findMany({
      where: {
        status: 'IN_PROGRESS',
        updatedAt: {
          lt: inactiveThreshold,
        },
      },
    });

    if (inactiveTasks.length > 0) {
      await this.notifyAdmins('inactive_tasks', {
        count: inactiveTasks.length,
        tasks: inactiveTasks.map(t => ({ id: t.id, projectId: t.projectId })),
      });
    }
  }

  /**
   * Clean up old notifications
   */
  private async cleanupOldNotifications(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
        isRead: true,
      },
    });

    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} old notifications`);
    }
  }
}