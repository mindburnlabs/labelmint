/**
 * Push Notification and App Badging System for LabelMint PWA
 * Handles push subscriptions, notifications, and badge updates
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  timestamp?: number;
}

export interface ScheduledNotification extends NotificationPayload {
  id: string;
  scheduledTime: number;
  repeat?: 'daily' | 'weekly' | 'monthly';
}

class NotificationManager {
  private subscription: PushSubscription | null = null;
  private isSupported: boolean = false;
  private permission: NotificationPermission = 'default';
  private swRegistration: ServiceWorkerRegistration | null = null;
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();

  constructor() {
    this.checkSupport();
  }

  /**
   * Check if push notifications are supported
   */
  private checkSupport(): void {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

    if (this.isSupported) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Initialize the notification system
   */
  async init(): Promise<void> {
    if (!this.isSupported) {
      console.warn('Push notifications are not supported');
      return;
    }

    try {
      // Register service worker if not already registered
      this.swRegistration = await navigator.serviceWorker.ready;

      // Get existing subscription
      this.subscription = await this.swRegistration.pushManager.getSubscription();

      // Listen for permission changes
      navigator.permissions.query({ name: 'notifications' }).then(permissionStatus => {
        permissionStatus.onchange = () => {
          this.permission = Notification.permission;
        };
      });

      // Load scheduled notifications from storage
      await this.loadScheduledNotifications();

      // Check for missed notifications
      this.checkMissedNotifications();

      console.log('Notification manager initialized');
    } catch (error) {
      console.error('Failed to initialize notification manager:', error);
    }
  }

  /**
   * Request permission for notifications
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(publicKey: string): Promise<PushSubscriptionData | null> {
    if (!this.isSupported || !this.swRegistration) {
      return null;
    }

    try {
      // Request permission if not granted
      if (this.permission !== 'granted') {
        const granted = await this.requestPermission();
        if (!granted) {
          throw new Error('Push notification permission denied');
        }
      }

      // Unsubscribe from existing subscription if any
      if (this.subscription) {
        await this.subscription.unsubscribe();
      }

      // Subscribe to push
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey)
      });

      this.subscription = subscription;

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      console.log('Successfully subscribed to push notifications');
      return subscription.toJSON() as PushSubscriptionData;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const unsubscribed = await this.subscription.unsubscribe();

      if (unsubscribed) {
        // Notify server
        await this.removeSubscriptionFromServer(this.subscription);
        this.subscription = null;
        console.log('Successfully unsubscribed from push notifications');
      }

      return unsubscribed;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Show a local notification
   */
  async showNotification(payload: NotificationPayload): Promise<void> {
    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/badge-72x72.png',
      tag: payload.tag || 'labelmint-notification',
      data: payload.data || {},
      requireInteraction: payload.requireInteraction || false,
      silent: payload.silent || false,
      timestamp: payload.timestamp || Date.now()
    };

    if (payload.image) options.image = payload.image;
    if (payload.actions) options.actions = payload.actions;
    if (payload.vibrate) options.vibrate = payload.vibrate;

    // Show notification
    if (this.swRegistration) {
      await this.swRegistration.showNotification(payload.title, options);
    } else {
      // Fallback to browser notification
      new Notification(payload.title, options);
    }
  }

  /**
   * Schedule a notification for later
   */
  async scheduleNotification(notification: ScheduledNotification): Promise<void> {
    // Store in IndexedDB
    await this.saveScheduledNotification(notification);

    // Also store in memory for quick access
    this.scheduledNotifications.set(notification.id, notification);

    // If service worker is available, let it handle the scheduling
    if (this.swRegistration) {
      this.swRegistration.active?.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        data: notification
      });
    }

    console.log('Notification scheduled:', notification);
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(id: string): Promise<void> {
    // Remove from storage
    await this.removeScheduledNotification(id);

    // Remove from memory
    this.scheduledNotifications.delete(id);

    // Notify service worker
    if (this.swRegistration) {
      this.swRegistration.active?.postMessage({
        type: 'CANCEL_SCHEDULED_NOTIFICATION',
        data: { id }
      });
    }

    console.log('Scheduled notification cancelled:', id);
  }

  /**
   * Update app badge
   */
  async updateBadge(count: number): Promise<void> {
    if ('setAppBadge' in navigator) {
      try {
        await navigator.setAppBadge(count);
      } catch (error) {
        console.error('Failed to set app badge:', error);
      }
    }

    // Fallback: update favicon badge
    this.updateFaviconBadge(count);
  }

  /**
   * Clear app badge
   */
  async clearBadge(): Promise<void> {
    if ('clearAppBadge' in navigator) {
      try {
        await navigator.clearAppBadge();
      } catch (error) {
        console.error('Failed to clear app badge:', error);
      }
    }

    // Clear favicon badge
    this.updateFaviconBadge(0);
  }

  /**
   * Get current subscription
   */
  getSubscription(): PushSubscription | null {
    return this.subscription;
  }

  /**
   * Check if notifications are supported
   */
  isNotificationSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Get current permission
   */
  getPermission(): NotificationPermission {
    return this.permission;
  }

  /**
   * Create notification channels (Android style)
   */
  async createChannel(channelId: string, name: string, description: string, importance: 'high' | 'default' | 'low' = 'default'): Promise<void> {
    // Store channel configuration
    const channel = {
      id: channelId,
      name,
      description,
      importance,
      vibration: importance === 'high' ? [200, 100, 200] : undefined,
      sound: importance === 'high' ? 'default' : undefined
    };

    localStorage.setItem(`notification_channel_${channelId}`, JSON.stringify(channel));
  }

  /**
   * Show notification with channel
   */
  async showChannelNotification(channelId: string, payload: NotificationPayload): Promise<void> {
    const channelConfig = localStorage.getItem(`notification_channel_${channelId}`);

    if (channelConfig) {
      const channel = JSON.parse(channelConfig);

      // Apply channel settings
      if (channel.vibration) {
        payload.vibrate = channel.vibration;
      }

      if (channel.importance === 'low') {
        payload.silent = true;
      }

      await this.showNotification(payload);
    } else {
      await this.showNotification(payload);
    }
  }

  // Private methods

  /**
   * Convert base64 string to Uint8Array
   */
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

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(subscription)
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

      // Store subscription ID
      const data = await response.json();
      localStorage.setItem('pushSubscriptionId', data.id);
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      const subscriptionId = localStorage.getItem('pushSubscriptionId');

      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          subscription,
          subscriptionId
        })
      });

      localStorage.removeItem('pushSubscriptionId');
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
    }
  }

  /**
   * Update favicon badge
   */
  private updateFaviconBadge(count: number): void {
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;

    if (!favicon) return;

    if (count === 0) {
      favicon.href = '/icons/icon-192x192.png';
      return;
    }

    // Create canvas for badge
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Draw base icon
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);

        // Draw badge
        const badgeSize = 60;
        const x = canvas.width - badgeSize - 10;
        const y = 10;

        // Background circle
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(x + badgeSize / 2, y + badgeSize / 2, badgeSize / 2, 0, 2 * Math.PI);
        ctx.fill();

        // Text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          count > 99 ? '99+' : count.toString(),
          x + badgeSize / 2,
          y + badgeSize / 2
        );

        // Update favicon
        favicon.href = canvas.toDataURL();
      };
      img.src = '/icons/icon-192x192.png';
    }
  }

  /**
   * Load scheduled notifications from storage
   */
  private async loadScheduledNotifications(): Promise<void> {
    try {
      const keys = await this.getAllStorageKeys('scheduled_notification_');

      for (const key of keys) {
        const notification = JSON.parse(localStorage.getItem(key) || '{}');
        this.scheduledNotifications.set(notification.id, notification);
      }
    } catch (error) {
      console.error('Failed to load scheduled notifications:', error);
    }
  }

  /**
   * Save scheduled notification to storage
   */
  private async saveScheduledNotification(notification: ScheduledNotification): Promise<void> {
    localStorage.setItem(
      `scheduled_notification_${notification.id}`,
      JSON.stringify(notification)
    );
  }

  /**
   * Remove scheduled notification from storage
   */
  private async removeScheduledNotification(id: string): Promise<void> {
    localStorage.removeItem(`scheduled_notification_${id}`);
  }

  /**
   * Check for missed notifications
   */
  private checkMissedNotifications(): void {
    const now = Date.now();

    for (const [id, notification] of this.scheduledNotifications) {
      if (notification.scheduledTime <= now) {
        // Show missed notification
        this.showNotification(notification);

        // Handle recurring notifications
        if (notification.repeat) {
          const nextTime = this.getNextScheduledTime(notification);
          if (nextTime) {
            notification.scheduledTime = nextTime;
            this.saveScheduledNotification(notification);
          } else {
            this.removeScheduledNotification(id);
            this.scheduledNotifications.delete(id);
          }
        } else {
          this.removeScheduledNotification(id);
          this.scheduledNotifications.delete(id);
        }
      }
    }
  }

  /**
   * Get next scheduled time for recurring notifications
   */
  private getNextScheduledTime(notification: ScheduledNotification): number | null {
    const now = Date.now();
    const scheduled = new Date(notification.scheduledTime);

    switch (notification.repeat) {
      case 'daily':
        scheduled.setDate(scheduled.getDate() + 1);
        break;
      case 'weekly':
        scheduled.setDate(scheduled.getDate() + 7);
        break;
      case 'monthly':
        scheduled.setMonth(scheduled.getMonth() + 1);
        break;
      default:
        return null;
    }

    return scheduled.getTime() > now ? scheduled.getTime() : null;
  }

  /**
   * Get all storage keys with prefix
   */
  private getAllStorageKeys(prefix: string): string[] {
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }

    return keys;
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();

// Initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    notificationManager.init().catch(console.error);
  });
}

// Export types
export type { PushSubscriptionData, NotificationPayload, ScheduledNotification };