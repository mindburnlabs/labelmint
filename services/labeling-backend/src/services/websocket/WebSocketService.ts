import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createAdapter } from 'socket.io-redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { Logger } from '../../utils/logger';
import { connectionPool } from '../../database/ConnectionPool';

const logger = new Logger('WebSocketService');

export interface AuthenticatedSocket extends Socket {
  userId: string;
  userRole: string;
  organizationId?: string;
}

export interface WebSocketEvent {
  event: string;
  data: any;
  timestamp: Date;
  userId?: string;
  room?: string;
}

export interface NotificationData {
  type: 'task_assigned' | 'task_completed' | 'payment_received' | 'delegate_updated' | 'system';
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high';
}

export class WebSocketService {
  private io: SocketIOServer;
  private redisClient: Redis;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs
  private userSockets: Map<string, AuthenticatedSocket> = new Map(); // socketId -> userId
  private roomMembers: Map<string, Set<string>> = new Map(); // room -> Set of userIds
  private metrics = {
    totalConnections: 0,
    messagesPerSecond: 0,
    errors: 0,
    reconnects: 0
  };

  constructor(server: HTTPServer) {
    // Initialize Redis client for multi-instance support
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    // Create Redis adapter for scaling
    const redisAdapter = createAdapter({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      pubClient: this.redisClient,
      subClient: this.redisClient
    });

    this.io = new SocketIOServer(server, {
      adapter: redisAdapter,
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      // Production settings
      wsEngine: process.env.NODE_ENV === 'production' ? 'ws' : undefined,
      compression: true,
      perMessageDeflate: {
        threshold: 1024,
        level: 3
      },
      // Rate limiting per connection
      maxHttpBufferSize: 1e8, // 100 MB
      // Connection middleware
      connectTimeout: 10000,
      // Security
      allowEIO3: true
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startHeartbeat();
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware() {
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        // Get user details from database using connection pool
        const userResult = await connectionPool.query(
          'SELECT id, role, organization_id FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (!userResult.rows.length) {
          return next(new Error('User not found'));
        }

        const user = userResult.rows[0];

        // Attach user info to socket
        socket.userId = user.id;
        socket.userRole = user.role;
        socket.organizationId = user.organization_id;

        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Invalid authentication token'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`User connected: ${socket.userId}, Socket: ${socket.id}`);

      // Track user connection
      if (!this.connectedUsers.has(socket.userId)) {
        this.connectedUsers.set(socket.userId, new Set());
      }
      this.connectedUsers.get(socket.userId)!.add(socket.id);
      this.userSockets.set(socket.id, socket);

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Join organization room if applicable
      if (socket.organizationId) {
        socket.join(`org:${socket.organizationId}`);
        if (!this.roomMembers.has(`org:${socket.organizationId}`)) {
          this.roomMembers.set(`org:${socket.organizationId}`, new Set());
        }
        this.roomMembers.get(`org:${socket.organizationId}`)!.add(socket.userId);
      }

      // Join role-based room
      socket.join(`role:${socket.userRole}`);

      // Send initial connection message
      socket.emit('connected', {
        socketId: socket.id,
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });

      // Handle custom events
      socket.on('join_room', (data: { room: string }) => {
        this.handleJoinRoom(socket, data);
      });

      socket.on('leave_room', (data: { room: string }) => {
        this.handleLeaveRoom(socket, data);
      });

      socket.on('subscribe_to_updates', (data: { types: string[] }) => {
        this.handleSubscribeToUpdates(socket, data);
      });

      socket.on('unsubscribe_from_updates', (data: { types: string[] }) => {
        this.handleUnsubscribeFromUpdates(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });

      // Error handling
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${socket.userId}:`, error);
      });
    });
  }

  /**
   * Handle room join
   */
  private async handleJoinRoom(socket: AuthenticatedSocket, data: { room: string }) {
    const { room } = data;

    // Validate room access
    if (!(await this.canAccessRoom(socket, room))) {
      socket.emit('error', { message: 'Access denied to room' });
      return;
    }

    socket.join(room);
    logger.info(`User ${socket.userId} joined room: ${room}`);

    // Track room membership
    if (!this.roomMembers.has(room)) {
      this.roomMembers.set(room, new Set());
    }
    this.roomMembers.get(room)!.add(socket.userId);

    socket.emit('joined_room', { room });
  }

  /**
   * Handle room leave
   */
  private handleLeaveRoom(socket: AuthenticatedSocket, data: { room: string }) {
    const { room } = data;
    socket.leave(room);

    // Update room membership
    const members = this.roomMembers.get(room);
    if (members) {
      members.delete(socket.userId);
      if (members.size === 0) {
        this.roomMembers.delete(room);
      }
    }

    socket.emit('left_room', { room });
  }

  /**
   * Handle subscription to updates
   */
  private handleSubscribeToUpdates(socket: AuthenticatedSocket, data: { types: string[] }) {
    data.types.forEach(type => {
      socket.join(`updates:${type}`);
    });
    socket.emit('subscribed', { types: data.types });
  }

  /**
   * Handle unsubscription from updates
   */
  private handleUnsubscribeFromUpdates(socket: AuthenticatedSocket, data: { types: string[] }) {
    data.types.forEach(type => {
      socket.leave(`updates:${type}`);
    });
    socket.emit('unsubscribed', { types: data.types });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: AuthenticatedSocket, reason: string) {
    logger.info(`User disconnected: ${socket.userId}, Reason: ${reason}`);

    // Clean up user connections
    const userSockets = this.connectedUsers.get(socket.userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(socket.userId);
      }
    }

    this.userSockets.delete(socket.id);

    // Clean up room memberships
    for (const [room, members] of this.roomMembers.entries()) {
      members.delete(socket.userId);
      if (members.size === 0) {
        this.roomMembers.delete(room);
      }
    }
  }

  /**
   * Check if user can access room
   */
  private async canAccessRoom(socket: AuthenticatedSocket, room: string): Promise<boolean> {
    // Allow personal rooms
    if (room.startsWith(`user:${socket.userId}`)) {
      return true;
    }

    // Allow organization rooms for org members
    if (room.startsWith('org:') && socket.organizationId) {
      return room === `org:${socket.organizationId}`;
    }

    // Allow admin-only rooms for admins
    if (room.startsWith('admin:') && socket.userRole === 'ADMIN') {
      return true;
    }

    // Allow specific project rooms (requires further validation)
    if (room.startsWith('project:')) {
      return this.checkProjectAccess(socket, room);
    }

    return false;
  }

  /**
   * Check project room access
   */
  private async checkProjectAccess(socket: AuthenticatedSocket, room: string): Promise<boolean> {
    const projectId = room.split(':')[1];

    try {
      const result = await connectionPool.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, socket.userId]
      );

      return result.length > 0;
    } catch (error) {
      logger.error('Error checking project access:', error);
      return false;
    }
  }

  /**
   * Send notification to specific user
   */
  async sendNotificationToUser(userId: string, notification: NotificationData) {
    const userSockets = this.connectedUsers.get(userId);

    if (!userSockets || userSockets.size === 0) {
      // User not connected, store notification for later
      await this.storeOfflineNotification(userId, notification);
      return;
    }

    // Send to all user's connected sockets
    this.io.to(`user:${userId}`).emit('notification', {
      id: this.generateNotificationId(),
      ...notification,
      timestamp: new Date().toISOString()
    });

    // Store notification in database
    await this.storeNotification(userId, notification);
  }

  /**
   * Send notification to organization members
   */
  async sendNotificationToOrganization(
    organizationId: string,
    notification: NotificationData,
    excludeUser?: string
  ) {
    const members = this.roomMembers.get(`org:${organizationId}`);

    if (members) {
      for (const userId of members) {
        if (excludeUser && userId === excludeUser) continue;
        await this.sendNotificationToUser(userId, notification);
      }
    }
  }

  /**
   * Send notification to role
   */
  async sendNotificationToRole(
    role: string,
    notification: NotificationData,
    excludeUser?: string
  ) {
    this.io.to(`role:${role}`).emit('notification', {
      id: this.generateNotificationId(),
      ...notification,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast real-time update
   */
  broadcastUpdate(type: string, data: any, room?: string) {
    const event = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    if (room) {
      this.io.to(room).emit('update', event);
    } else {
      this.io.emit('update', event);
    }

    logger.info(`Broadcasted update: ${type} to ${room || 'all'}`);
  }

  /**
   * Send task assignment notification
   */
  async sendTaskAssignment(taskId: string, assigneeId: string, taskDetails: any) {
    await this.sendNotificationToUser(assigneeId, {
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: `You have been assigned a new task: ${taskDetails.title}`,
      data: { taskId, taskDetails },
      priority: 'medium'
    });

    this.broadcastUpdate('task_assigned', {
      taskId,
      assigneeId,
      taskDetails
    }, `updates:tasks`);
  }

  /**
   * Send task completion notification
   */
  async sendTaskCompletion(taskId: string, completedBy: string, taskDetails: any) {
    const task = await connectionPool.query(
      'SELECT owner_id, organization_id FROM tasks WHERE id = $1',
      [taskId]
    );

    if (task.rows.length > 0) {
      const { owner_id, organization_id } = task.rows[0];

      // Notify task owner
      await this.sendNotificationToUser(owner_id, {
        type: 'task_completed',
        title: 'Task Completed',
        message: `Task "${taskDetails.title}" has been completed`,
        data: { taskId, completedBy, taskDetails },
        priority: 'high'
      });

      // Notify organization members
      if (organization_id) {
        await this.sendNotificationToOrganization(organization_id, {
          type: 'task_completed',
          title: 'Task Completed',
          message: `A task has been completed`,
          data: { taskId, completedBy },
          priority: 'medium'
        }, completedBy);
      }
    }

    this.broadcastUpdate('task_completed', {
      taskId,
      completedBy,
      taskDetails
    }, `updates:tasks`);
  }

  /**
   * Send payment notification
   */
  async sendPaymentNotification(userId: string, paymentDetails: any) {
    await this.sendNotificationToUser(userId, {
      type: 'payment_received',
      title: 'Payment Received',
      message: `You have received a payment of ${paymentDetails.amount} ${paymentDetails.currency}`,
      data: paymentDetails,
      priority: 'high'
    });

    this.broadcastUpdate('payment_received', {
      userId,
      paymentDetails
    }, `updates:payments`);
  }

  /**
   * Send delegate update notification
   */
  async sendDelegateUpdate(delegateId: string, updateType: string, updateDetails: any) {
    const delegate = await connectionPool.query(
      'SELECT owner_id FROM delegates WHERE id = $1',
      [delegateId]
    );

    if (delegate.rows.length > 0) {
      await this.sendNotificationToUser(delegate.rows[0].owner_id, {
        type: 'delegate_updated',
        title: 'Delegate Updated',
        message: `Delegate status has been ${updateType}`,
        data: { delegateId, updateType, updateDetails },
        priority: 'medium'
      });
    }

    this.broadcastUpdate('delegate_updated', {
      delegateId,
      updateType,
      updateDetails
    }, `updates:delegates`);
  }

  /**
   * Store notification in database
   */
  private async storeNotification(userId: string, notification: NotificationData) {
    try {
      await connectionPool.query(
        `INSERT INTO notifications
         (user_id, type, title, message, data, priority, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          notification.type,
          notification.title,
          notification.message,
          JSON.stringify(notification.data),
          notification.priority
        ]
      );
    } catch (error) {
      logger.error('Error storing notification:', error);
    }
  }

  /**
   * Store offline notification
   */
  private async storeOfflineNotification(userId: string, notification: NotificationData) {
    try {
      await connectionPool.query(
        `INSERT INTO offline_notifications
         (user_id, type, title, message, data, priority, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          notification.type,
          notification.title,
          notification.message,
          JSON.stringify(notification.data),
          notification.priority
        ]
      );
    } catch (error) {
      logger.error('Error storing offline notification:', error);
    }
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat() {
    setInterval(() => {
      this.io.emit('heartbeat', {
        timestamp: new Date().toISOString(),
        connectedUsers: this.connectedUsers.size
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      totalConnections: this.userSockets.size,
      activeRooms: this.roomMembers.size
    };
  }

  /**
   * Close WebSocket server
   */
  close() {
    this.io.close();
    logger.info('WebSocket server closed');
  }
}