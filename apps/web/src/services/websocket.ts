import { io, Socket } from 'socket.io-client';

export interface NotificationData {
  id: string;
  type: 'task_assigned' | 'task_completed' | 'payment_received' | 'delegate_updated' | 'system';
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  read?: boolean;
}

export interface RealtimeUpdate {
  type: string;
  data: any;
  timestamp: string;
}

export interface WebSocketConfig {
  url?: string;
  token?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionAttempts?: number;
}

class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private subscriptions: Set<string> = new Set();
  private rooms: Set<string> = new Set();
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: WebSocketConfig = {}) {
    this.config = {
      url: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000',
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      ...config
    };

    if (this.config.autoConnect) {
      this.connect();
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnecting || (this.socket && this.socket.connected)) {
      return;
    }

    this.isConnecting = true;

    try {
      // Get auth token
      const token = this.getAuthToken();

      if (!token) {
        throw new Error('No authentication token available');
      }

      // Create socket connection
      this.socket = io(this.config!.url!, {
        auth: { token },
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: true
      });

      this.setupEventHandlers();

      return new Promise((resolve, reject) => {
        if (!this.socket) return reject(new Error('Socket not initialized'));

        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket.on('connect', () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          console.log('WebSocket connected');

          // Rejoin rooms and subscriptions
          this.resubscribe();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          console.error('WebSocket connection error:', error);
          reject(error);
        });
      });

    } catch (error) {
      this.isConnecting = false;
      console.error('Failed to connect to WebSocket:', error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.subscriptions.clear();
    this.rooms.clear();
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.handleDisconnect(reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('WebSocket reconnection attempt:', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Custom events
    this.socket.on('notification', (notification: NotificationData) => {
      this.handleNotification(notification);
    });

    this.socket.on('update', (update: RealtimeUpdate) => {
      this.handleUpdate(update);
    });

    this.socket.on('heartbeat', (data) => {
      console.log('WebSocket heartbeat:', data);
    });

    // Room events
    this.socket.on('joined_room', (data) => {
      console.log('Joined room:', data.room);
    });

    this.socket.on('left_room', (data) => {
      console.log('Left room:', data.room);
    });

    // Subscription events
    this.socket.on('subscribed', (data) => {
      console.log('Subscribed to updates:', data.types);
    });

    this.socket.on('unsubscribed', (data) => {
      console.log('Unsubscribed from updates:', data.types);
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(reason: string): void {
    if (this.config.reconnection && this.reconnectAttempts < (this.config.reconnectionAttempts || 5)) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, this.config.reconnectionDelay);
    }
  }

  /**
   * Handle notification
   */
  private handleNotification(notification: NotificationData): void {
    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        data: notification.data
      });
    }

    // Emit to listeners
    this.emit('notification', notification);
  }

  /**
   * Handle real-time update
   */
  private handleUpdate(update: RealtimeUpdate): void {
    this.emit('update', update);
    this.emit(`update:${update.type}`, update.data);
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string | null {
    if (this.config.token) {
      return this.config.token;
    }

    // Try to get from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    }

    return null;
  }

  /**
   * Join a room
   */
  async joinRoom(room: string): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      await this.connect();
    }

    this.socket!.emit('join_room', { room });
    this.rooms.add(room);
  }

  /**
   * Leave a room
   */
  leaveRoom(room: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_room', { room });
    }
    this.rooms.delete(room);
  }

  /**
   * Subscribe to update types
   */
  async subscribeToUpdates(types: string[]): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      await this.connect();
    }

    this.socket!.emit('subscribe_to_updates', { types });
    types.forEach(type => this.subscriptions.add(type));
  }

  /**
   * Unsubscribe from update types
   */
  unsubscribeFromUpdates(types: string[]): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe_from_updates', { types });
    }
    types.forEach(type => this.subscriptions.delete(type));
  }

  /**
   * Resubscribe to rooms and updates after reconnection
   */
  private resubscribe(): void {
    if (this.socket && this.socket.connected) {
      // Rejoin rooms
      this.rooms.forEach(room => {
        this.socket!.emit('join_room', { room });
      });

      // Resubscribe to updates
      if (this.subscriptions.size > 0) {
        this.socket.emit('subscribe_to_updates', {
          types: Array.from(this.subscriptions)
        });
      }
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback?: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      if (callback) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      } else {
        listeners.length = 0;
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket event listener:', error);
        }
      });
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<boolean> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get connection stats
   */
  getConnectionStats() {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      rooms: Array.from(this.rooms),
      subscriptions: Array.from(this.subscriptions)
    };
  }
}

// Create singleton instance
export const websocketService = new WebSocketService();

export default websocketService;