import { Server as SocketIOServer } from 'socket.io';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { AuditLogger } from './utils/audit';

interface CollaborationEvent {
  type: string;
  userId: string;
  organizationId: string;
  projectId?: string;
  data: any;
  timestamp: Date;
}

interface PresenceData {
  userId: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  room: string;
  lastSeen: Date;
  cursor?: {
    x: number;
    y: number;
  };
  permissions: string[];
}

export class CollaborationService {
  private io: SocketIOServer;
  private redis: Redis;
  private prisma: PrismaClient;
  private activeUsers: Map<string, Map<string, PresenceData>> = new Map(); // room -> userId -> presence
  private operations: Map<string, any> = new Map(); // ongoing operations with locks

  constructor(io: SocketIOServer, redis: Redis, prisma: PrismaClient) {
    this.io = io;
    this.redis = redis;
    this.prisma = prisma;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      const userId = (socket.handshake.auth as any).userId;

      if (!userId) {
        socket.disconnect();
        return;
      }

      logger.info(`User ${userId} connected to collaboration service`);

      // Setup user-specific handlers
      socket.on('join-project', (data) => this.handleJoinProject(socket, userId, data));
      socket.on('leave-project', (data) => this.handleLeaveProject(socket, userId, data));
      socket.on('cursor-move', (data) => this.handleCursorMove(socket, userId, data));
      socket.on('operation-start', (data) => this.handleOperationStart(socket, userId, data));
      socket.on('operation-end', (data) => this.handleOperationEnd(socket, userId, data));
      socket.on('message', (data) => this.handleMessage(socket, userId, data));
      socket.on('notification', (data) => this.handleNotification(socket, userId, data));
      socket.on('disconnect', () => this.handleDisconnect(socket, userId));
    });
  }

  /**
   * Handle user joining a project room
   */
  private async handleJoinProject(
    socket: any,
    userId: string,
    data: {
      projectId: string;
      organizationId: string;
    }
  ): Promise<void> {
    try {
      const { projectId, organizationId } = data;

      // Verify user has access to project
      const hasAccess = await this.verifyProjectAccess(userId, projectId, organizationId);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to project' });
        return;
      }

      // Get user details
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true
        }
      });

      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Join socket room
      const room = `project:${projectId}`;
      socket.join(room);

      // Update presence
      if (!this.activeUsers.has(room)) {
        this.activeUsers.set(room, new Map());
      }

      const presence: PresenceData = {
        userId,
        user: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          avatar: user.avatar
        },
        room,
        lastSeen: new Date(),
        permissions: await this.getUserPermissions(userId, organizationId)
      };

      this.activeUsers.get(room)?.set(userId, presence);

      // Store in Redis for cross-server sync
      await this.redis.setex(
        `presence:${room}:${userId}`,
        300, // 5 minutes
        JSON.stringify(presence)
      );

      // Notify others in room
      socket.to(room).emit('user-joined', {
        user: presence.user,
        activeUsers: Array.from(this.activeUsers.get(room)?.values() || [])
      });

      // Send current state to joining user
      socket.emit('project-state', {
        activeUsers: Array.from(this.activeUsers.get(room)?.values() || []),
        currentOperations: await this.getActiveOperations(projectId),
        recentActivity: await this.getRecentActivity(projectId)
      });

      // Log audit
      await AuditLogger.log({
        organizationId,
        userId,
        resourceType: 'PROJECT',
        resourceId: projectId,
        action: 'JOIN_COLLABORATION',
        details: { socketId: socket.id }
      }, this.prisma);

    } catch (error) {
      logger.error('Failed to join project:', error);
      socket.emit('error', { message: 'Failed to join project' });
    }
  }

  /**
   * Handle user leaving a project room
   */
  private async handleLeaveProject(
    socket: any,
    userId: string,
    data: { projectId: string }
  ): Promise<void> {
    try {
      const { projectId } = data;
      const room = `project:${projectId}`;

      // Leave socket room
      socket.leave(room);

      // Remove from active users
      this.activeUsers.get(room)?.delete(userId);

      // Remove from Redis
      await this.redis.del(`presence:${room}:${userId}`);

      // Notify others
      socket.to(room).emit('user-left', {
        userId,
        activeUsers: Array.from(this.activeUsers.get(room)?.values() || [])
      });

      // Clean up if room is empty
      if (this.activeUsers.get(room)?.size === 0) {
        this.activeUsers.delete(room);
      }

      // Log audit
      const orgId = await this.getProjectOrganizationId(projectId);
      await AuditLogger.log({
        organizationId: orgId,
        userId,
        resourceType: 'PROJECT',
        resourceId: projectId,
        action: 'LEAVE_COLLABORATION',
        details: { socketId: socket.id }
      }, this.prisma);

    } catch (error) {
      logger.error('Failed to leave project:', error);
    }
  }

  /**
   * Handle cursor movement (for real-time cursors)
   */
  private async handleCursorMove(
    socket: any,
    userId: string,
    data: {
      projectId: string;
      x: number;
      y: number;
    }
  ): Promise<void> {
    try {
      const { projectId, x, y } = data;
      const room = `project:${projectId}`;

      // Update cursor position in presence
      const presence = this.activeUsers.get(room)?.get(userId);
      if (presence) {
        presence.cursor = { x, y };
        presence.lastSeen = new Date();

        // Update in Redis
        await this.redis.setex(
          `presence:${room}:${userId}`,
          300,
          JSON.stringify(presence)
        );
      }

      // Broadcast cursor position
      socket.to(room).emit('cursor-update', {
        userId,
        cursor: { x, y }
      });

    } catch (error) {
      logger.error('Failed to update cursor:', error);
    }
  }

  /**
   * Handle start of an operation (with lock)
   */
  private async handleOperationStart(
    socket: any,
    userId: string,
    data: {
      projectId: string;
      operationId: string;
      operationType: string;
      target: any;
      metadata?: any;
    }
  ): Promise<void> {
    try {
      const { projectId, operationId, operationType, target, metadata } = data;
      const room = `project:${projectId}`;

      // Check if operation is already locked
      const existingOperation = await this.redis.get(`operation:${projectId}:${target.id}`);
      if (existingOperation) {
        socket.emit('operation-denied', {
          operationId,
          reason: 'Resource is locked by another user',
          lockedBy: JSON.parse(existingOperation)
        });
        return;
      }

      // Acquire lock with timeout
      const lockData = {
        userId,
        operationType,
        startTime: Date.now(),
        metadata
      };

      const lockAcquired = await this.redis.set(
        `operation:${projectId}:${target.id}`,
        JSON.stringify(lockData),
        'PX', 30000, // 30 second timeout
        'NX' // Only set if not exists
      );

      if (!lockAcquired) {
        socket.emit('operation-denied', {
          operationId,
          reason: 'Failed to acquire lock'
        });
        return;
      }

      // Store operation info
      this.operations.set(operationId, {
        userId,
        projectId,
        operationType,
        target,
        socketId: socket.id,
        startTime: Date.now()
      });

      // Notify others
      socket.to(room).emit('operation-started', {
        operationId,
        operationType,
        target,
        user: await this.getUserInfo(userId),
        metadata
      });

    } catch (error) {
      logger.error('Failed to start operation:', error);
    }
  }

  /**
   * Handle end of operation
   */
  private async handleOperationEnd(
    socket: any,
    userId: string,
    data: {
      projectId: string;
      operationId: string;
      result: any;
      changes?: any;
    }
  ): Promise<void> {
    try {
      const { projectId, operationId, result, changes } = data;
      const room = `project:${projectId}`;
      const operation = this.operations.get(operationId);

      if (!operation) {
        logger.error(`Operation ${operationId} not found`);
        return;
      }

      // Release lock
      await this.redis.del(`operation:${projectId}:${operation.target.id}`);

      // Remove from active operations
      this.operations.delete(operationId);

      // Calculate duration
      const duration = Date.now() - operation.startTime;

      // Store operation history
      await this.prisma.operationHistory.create({
        data: {
          organizationId: await this.getProjectOrganizationId(projectId),
          projectId,
          userId: operation.userId,
          operationType: operation.operationType,
          targetId: operation.target.id,
          targetType: operation.target.type,
          result,
          changes,
          duration
        }
      });

      // Notify others
      socket.to(room).emit('operation-completed', {
        operationId,
        operationType: operation.operationType,
        target: operation.target,
        result,
        changes,
        duration,
        user: await this.getUserInfo(userId)
      });

      // Log audit
      await AuditLogger.log({
        organizationId: await this.getProjectOrganizationId(projectId),
        userId,
        resourceType: 'PROJECT',
        resourceId: projectId,
        action: 'OPERATION_COMPLETED',
        details: {
          operationId,
          operationType: operation.operationType,
          target: operation.target.id,
          duration
        }
      }, this.prisma);

    } catch (error) {
      logger.error('Failed to complete operation:', error);
    }
  }

  /**
   * Handle chat/messaging in collaboration
   */
  private async handleMessage(
    socket: any,
    userId: string,
    data: {
      projectId: string;
      type: 'message' | '@mention' | 'comment';
      content: string;
      targetUserId?: string;
      metadata?: any;
    }
  ): Promise<void> {
    try {
      const { projectId, type, content, targetUserId, metadata } = data;
      const room = `project:${projectId}`;

      // Create message record
      const message = await this.prisma.collaborationMessage.create({
        data: {
          organizationId: await this.getProjectOrganizationId(projectId),
          projectId,
          userId,
          type,
          content,
          targetUserId,
          metadata
        }
      });

      // Get message with user info
      const fullMessage = await this.prisma.collaborationMessage.findUnique({
        where: { id: message.id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          }
        }
      });

      // Broadcast message
      this.io.to(room).emit('message', fullMessage);

      // Send notification for @mentions
      if (type === '@mention' && targetUserId) {
        this.sendNotification(targetUserId, {
          type: 'MENTION',
          projectId,
          fromUserId: userId,
          message: content
        });
      }

      // Log audit
      await AuditLogger.log({
        organizationId: await this.getProjectOrganizationId(projectId),
        userId,
        resourceType: 'COLLABORATION_MESSAGE',
        resourceId: message.id,
        action: 'CREATE',
        details: { type, targetUserId }
      }, this.prisma);

    } catch (error) {
      logger.error('Failed to send message:', error);
    }
  }

  /**
   * Handle user disconnection
   */
  private async handleDisconnect(
    socket: any,
    userId: string
  ): Promise<void> {
    try {
      logger.info(`User ${userId} disconnected from collaboration service`);

      // Find all rooms user was in
      const rooms = Array.from(socket.rooms).filter(room => room.startsWith('project:'));

      for (const room of rooms) {
        // Remove from active users
        this.activeUsers.get(room)?.delete(userId);

        // Remove from Redis
        await this.redis.del(`presence:${room}:${userId}`);

        // Notify others
        socket.to(room).emit('user-left', {
          userId,
          activeUsers: Array.from(this.activeUsers.get(room)?.values() || [])
        });

        // Clean up if room is empty
        if (this.activeUsers.get(room)?.size === 0) {
          this.activeUsers.delete(room);
        }
      }

    } catch (error) {
      logger.error('Failed to handle disconnect:', error);
    }
  }

  /**
   * Helper methods
   */
  private async verifyProjectAccess(
    userId: string,
    projectId: string,
    organizationId: string
  ): Promise<boolean> {
    const access = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        OR: [
          {
            teams: {
              some: {
                team: {
                  members: {
                    some: { userId }
                  }
                }
              }
            }
          },
          {
            organization: {
              users: {
                some: {
                  userId,
                  permissions: {
                    path: '$.canManageProjects',
                    eq: true
                  }
                }
              }
            }
          }
        ]
      }
    });

    return !!access;
  }

  private async getUserPermissions(
    userId: string,
    organizationId: string
  ): Promise<string[]> {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: {
        organizationId,
        userId
      }
    });

    return orgUser?.permissions || [];
  }

  private async getUserInfo(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true
      }
    });

    return user;
  }

  private async getProjectOrganizationId(projectId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true }
    });

    return project.organizationId;
  }

  private async getActiveOperations(projectId: string): Promise<any[]> {
    // Get operations from the last 24 hours
    const operations = await this.prisma.operationHistory.findMany({
      where: {
        projectId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return operations;
  }

  private async getRecentActivity(projectId: string): Promise<any[]> {
    // Combine various activity types
    const [operations, messages, audits] = await Promise.all([
      this.prisma.operationHistory.findMany({
        where: {
          projectId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        take: 20,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.collaborationMessage.findMany({
        where: {
          projectId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          }
        }
      }),
      this.prisma.auditLog.findMany({
        where: {
          resourceId: projectId,
          resourceType: 'PROJECT',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        take: 20,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    // Combine and sort by timestamp
    const activities = [
      ...operations.map(op => ({ ...op, type: 'operation' })),
      ...messages.map(msg => ({ ...msg, type: 'message' })),
      ...audits.map(audit => ({ ...audit, type: 'audit' }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return activities.slice(0, 50);
  }

  private async sendNotification(
    userId: string,
    notification: any
  ): Promise<void> {
    // Store notification in database
    await this.prisma.notification.create({
      data: {
        userId,
        type: 'COLLABORATION',
        title: notification.type === 'MENTION' ? 'You were mentioned' : 'New collaboration message',
        message: notification.message,
        data: notification
      }
    });

    // Emit to user's connected sockets
    this.io.to(`user:${userId}`).emit('notification', notification);
  }
}