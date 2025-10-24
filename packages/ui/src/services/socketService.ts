import { io, Socket } from 'socket.io-client';

export interface SocketConfig {
  url: string;
  auth?: {
    token?: string;
    userId?: string;
  };
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface SocketEvents {
  // Connection events
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;
  reconnect: (attemptNumber: number) => void;
  reconnect_attempt: (attemptNumber: number) => void;
  reconnect_error: (error: Error) => void;
  reconnect_failed: () => void;

  // Task events
  'task:new': (task: any) => void;
  'task:update': (task: any) => void;
  'task:completed': (data: { taskId: string; userId: string }) => void;
  'task:assigned': (data: { taskId: string; userId: string }) => void;

  // User events
  'user:online': (userId: string) => void;
  'user:offline': (userId: string) => void;
  'user:balance_update': (data: { userId: string; newBalance: number }) => void;
  'user:notification': (notification: any) => void;

  // Payment events
  'payment:received': (payment: any) => void;
  'payment:confirmed': (payment: any) => void;
  'payment:failed': (payment: any) => void;

  // Leaderboard events
  'leaderboard:update': (leaderboard: any[]) => void;

  // System events
  'system:maintenance': (data: { message: string; startTime: string }) => void;
  'system:announcement': (announcement: any) => void;
}

export type SocketEventName = keyof SocketEvents;
export type SocketEventHandler<E extends SocketEventName> = SocketEvents[E];

export class SocketService {
  private socket: Socket | null = null;
  private config: SocketConfig;
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private isInitialized: boolean = false;

  constructor(config: SocketConfig) {
    this.config = {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: false,
      ...config,
    };
  }

  /**
   * Initialize and connect the socket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      try {
        this.socket = io(this.config.url, {
          auth: this.config.auth,
          reconnection: this.config.reconnection,
          reconnectionAttempts: this.config.reconnectionAttempts,
          reconnectionDelay: this.config.reconnectionDelay,
          transports: ['websocket', 'polling'],
        });

        // Set up connection event handlers
        this.socket.on('connect', () => {
          console.log('[Socket] Connected to server');
          this.isInitialized = true;
          this.emit('connect');
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[Socket] Disconnected:', reason);
          this.emit('disconnect', reason);
        });

        this.socket.on('connect_error', (error) => {
          console.error('[Socket] Connection error:', error);
          this.emit('connect_error', error);
          reject(error);
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
          this.emit('reconnect', attemptNumber);
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
          console.log('[Socket] Reconnection attempt', attemptNumber);
          this.emit('reconnect_attempt', attemptNumber);
        });

        this.socket.on('reconnect_error', (error) => {
          console.error('[Socket] Reconnection error:', error);
          this.emit('reconnect_error', error);
        });

        this.socket.on('reconnect_failed', () => {
          console.error('[Socket] Reconnection failed');
          this.emit('reconnect_failed');
        });

        // Auto-connect if enabled
        if (this.config.autoConnect !== false) {
          this.socket.connect();
        }
      } catch (error) {
        console.error('[Socket] Failed to initialize:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect the socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Subscribe to an event
   */
  on<E extends SocketEventName>(event: E, handler: SocketEventHandler<E>): void {
    if (!this.socket) {
      console.warn(`[Socket] Cannot subscribe to ${event}: socket not initialized`);
      return;
    }

    // Store handler for internal tracking
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Subscribe to socket event
    this.socket.on(event, handler as any);
  }

  /**
   * Unsubscribe from an event
   */
  off<E extends SocketEventName>(event: E, handler?: SocketEventHandler<E>): void {
    if (!this.socket) return;

    if (handler) {
      // Remove specific handler
      this.eventHandlers.get(event)?.delete(handler);
      this.socket.off(event, handler as any);
    } else {
      // Remove all handlers for this event
      this.eventHandlers.delete(event);
      this.socket.off(event);
    }
  }

  /**
   * Emit an event to the server
   */
  emit(event: string, ...args: any[]): void {
    if (!this.socket?.connected) {
      console.warn(`[Socket] Cannot emit ${event}: socket not connected`);
      return;
    }

    this.socket.emit(event, ...args);
  }

  /**
   * Emit an event and wait for acknowledgment
   */
  emitWithAck<T = any>(event: string, data?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Socket emit timeout'));
      }, 10000); // 10 second timeout

      this.socket.emit(event, data, (response: T) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  /**
   * Join a room
   */
  async joinRoom(room: string): Promise<void> {
    return this.emitWithAck('room:join', { room });
  }

  /**
   * Leave a room
   */
  async leaveRoom(room: string): Promise<void> {
    return this.emitWithAck('room:leave', { room });
  }

  /**
   * Subscribe to user-specific events
   */
  subscribeToUser(userId: string): void {
    this.joinRoom(`user:${userId}`);
  }

  /**
   * Subscribe to project-specific events
   */
  subscribeToProject(projectId: string): void {
    this.joinRoom(`project:${projectId}`);
  }

  /**
   * Subscribe to global events
   */
  subscribeToGlobal(): void {
    this.joinRoom('global');
  }

  /**
   * Update authentication token
   */
  updateAuth(auth: { token?: string; userId?: string }): void {
    if (this.socket) {
      this.socket.auth = { ...this.socket.auth, ...auth };
      
      // Reconnect with new auth
      if (this.socket.connected) {
        this.socket.disconnect();
        this.socket.connect();
      }
    }
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Clean up all event handlers
   */
  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
    this.eventHandlers.clear();
  }
}

/**
 * Default export for convenience
 */
let defaultSocketService: SocketService | null = null;

export function initializeSocketService(config: SocketConfig): SocketService {
  defaultSocketService = new SocketService(config);
  return defaultSocketService;
}

export function getSocketService(): SocketService {
  if (!defaultSocketService) {
    throw new Error('SocketService not initialized. Call initializeSocketService first.');
  }
  return defaultSocketService;
}

export default SocketService;

