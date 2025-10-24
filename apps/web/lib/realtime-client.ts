import { io, Socket } from 'socket.io-client';
import { RealtimeClientOptions } from './types';

export class RealtimeClient {
  private socket: Socket | null = null;
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions: Set<string> = new Set();
  private notificationCallbacks: Map<string, Function[]> = new Map();

  constructor(private options: RealtimeClientOptions) {}

  async connect(): Promise<void> {
    try {
      await this.connectSocket();
      await this.setupFallback();
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  }

  private async connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.options.serverUrl, {
        auth: {
          token: this.options.token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        forceNew: true
      });

      this.socket.on('connect', () => {
        console.log('Connected to real-time server');
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from real-time server:', reason);
        if (reason === 'io server disconnect') {
          this.connect();
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        this.resubscribeAll();
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.switchToSSE();
        }
      });
    });
  }

  private async setupFallback(): Promise<void> {
    if ('EventSource' in window) {
      this.connectSSE();
    }
  }

  private connectSSE(): void {
    const sseUrl = `${this.options.serverUrl}/api/realtime/sse`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onopen = () => {
      console.log('SSE connection opened');
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        setTimeout(() => this.connectSSE(), 5000);
      }
    };

    this.eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      console.log('SSE connected:', data.connectionId);
    });
  }

  private switchToSSE(): void {
    console.log('Switching to SSE fallback');
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (!this.eventSource) {
      this.connectSSE();
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('notification', (notification) => {
      this.handleNotification(notification);
    });

    this.socket.on('task_assigned', (data) => {
      this.emit('task_assigned', data);
    });

    this.socket.on('task_updated', (data) => {
      this.emit('task_updated', data);
    });

    this.socket.on('progress_update', (data) => {
      this.emit('progress_update', data);
    });

    this.socket.on('quality_update', (data) => {
      this.emit('quality_update', data);
    });

    this.socket.on('collaboration_started', (data) => {
      this.emit('collaboration_started', data);
    });

    this.socket.on('live_progress', (data) => {
      this.emit('live_progress', data);
    });

    this.socket.on('analytics_update', (data) => {
      this.emit('analytics_update', data);
    });

    this.socket.on('project_quality', (data) => {
      this.emit('project_quality', data);
    });

    this.socket.on('leaderboard_updated', (data) => {
      this.emit('leaderboard_updated', data);
    });

    this.socket.on('user_joined', (data) => {
      this.emit('user_joined', data);
    });

    this.socket.on('user_left', (data) => {
      this.emit('user_left', data);
    });
  }

  private handleMessage(message: any): void {
    if (message.type && this.notificationCallbacks.has(message.type)) {
      const callbacks = this.notificationCallbacks.get(message.type)!;
      callbacks.forEach(callback => callback(message.data));
    }
  }

  private handleNotification(notification: any): void {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      this.showBrowserNotification(notification);
    }

    this.emit('notification', notification);
  }

  private showBrowserNotification(notification: any): void {
    if (Notification.permission === 'granted') {
      new Notification(notification.title || 'Deligate.it', {
        body: notification.message,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: notification.type,
        requireInteraction: notification.priority === 'critical',
        data: notification.data
      });
    }
  }

  joinProject(projectId: string, role: string = 'worker'): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_project', { projectId, role });
    }
    this.subscriptions.add(`project:${projectId}`);
  }

  leaveProject(projectId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_project', { projectId });
    }
    this.subscriptions.delete(`project:${projectId}`);
  }

  updateTaskProgress(data: {
    taskId: string;
    projectId: string;
    progress: number;
    status: string;
    timeSpent?: number;
    quality?: number;
  }): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('task_progress', data);
    }
  }

  startCollaboration(data: {
    taskId: string;
    participants: string[];
    deadline?: number;
  }): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('start_collaboration', data);
    }
  }

  joinCollaboration(taskId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_collaboration', { taskId });
    }
  }

  sendCollaboration(data: {
    taskId: string;
    action: string;
    payload: any;
  }): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('collaborate', data);
    }
  }

  typingStart(taskId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing_start', { taskId });
    }
  }

  typingStop(taskId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing_stop', { taskId });
    }
  }

  subscribeToPushNotifications(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        reject(new Error('Push notifications not supported'));
        return;
      }

      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.options.vapidPublicKey)
        }).then((subscription) => {
          fetch(`${this.options.serverUrl}/api/realtime/notifications/subscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.options.token}`
            },
            body: JSON.stringify({ subscription })
          }).then(response => {
            if (response.ok) {
              resolve();
            } else {
              reject(new Error('Failed to subscribe to push notifications'));
            }
          });
        }).catch(reject);
      });
    });
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  on(event: string, callback: Function): void {
    if (!this.notificationCallbacks.has(event)) {
      this.notificationCallbacks.set(event, []);
    }
    this.notificationCallbacks.get(event)!.push(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: Function): void {
    if (callback) {
      const callbacks = this.notificationCallbacks.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
      if (this.socket) {
        this.socket.off(event, callback);
      }
    } else {
      this.notificationCallbacks.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.notificationCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach(subscription => {
      if (subscription.startsWith('project:')) {
        const projectId = subscription.replace('project:', '');
        this.joinProject(projectId);
      }
    });
  }

  isConnected(): boolean {
    return this.socket?.connected || this.eventSource?.readyState === EventSource.OPEN;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.subscriptions.clear();
    this.notificationCallbacks.clear();
  }
}

export default RealtimeClient;