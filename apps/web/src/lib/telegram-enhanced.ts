/**
 * Enhanced Telegram Web App Integration for LabelMint
 * Implements advanced TWA features for enterprise use
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  platform: string;
  platformVersion: string;
  screenResolution: string;
  viewportHeight: number;
  viewportStableHeight: number;
  viewportWidth: number;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
}

export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface BiometricAuthRequest {
  reason: string;
  prompt?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface ContactData {
  userId: number;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  vcard?: string;
}

export interface FileData {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  path?: string;
}

export interface NotificationSchedule {
  id: string;
  title: string;
  body: string;
  scheduledTime: number;
  data?: any;
  icon?: string;
  badge?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class TelegramWebAppEnhanced {
  private tg: any;
  private deviceInfo: DeviceInfo;
  private isInitialized: boolean = false;
  private offlineQueue: Array<{ type: string; data: any }> = [];
  private biometricAvailable: boolean = false;
  private locationAvailable: boolean = false;
  private contactsAvailable: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && window.Telegram) {
      this.tg = window.Telegram.WebApp;
      this.initialize();
    }
  }

  /**
   * Initialize the enhanced Telegram Web App
   */
  private async initialize(): Promise<void> {
    if (!this.tg) {
      console.warn('Telegram WebApp is not available');
      return;
    }

    try {
      // Enable expansion to full screen
      this.tg.expand();

      // Enable closing confirmation
      this.tg.enableClosingConfirmation();

      // Set header color
      this.tg.setHeaderColor(this.tg.themeParams.bg_color || '#4F46E5');

      // Set background color
      this.tg.setBackgroundColor(this.tg.themeParams.bg_color || '#ffffff');

      // Get device information
      this.deviceInfo = this.generateDeviceInfo();

      // Check available features
      await this.checkAvailableFeatures();

      // Setup event listeners
      this.setupEventListeners();

      // Optimize for device
      this.optimizeForDevice();

      this.isInitialized = true;

      // Notify app about ready state
      this.tg.ready();

      console.log('Telegram WebApp Enhanced initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Telegram WebApp Enhanced:', error);
    }
  }

  /**
   * Generate comprehensive device information
   */
  private generateDeviceInfo(): DeviceInfo {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = /iPad|Android.*Mobile/i.test(navigator.userAgent) && window.innerWidth > 768;
    const isDesktop = !isMobile && !isTablet;

    return {
      isMobile,
      isTablet,
      isDesktop,
      platform: this.tg.platform || 'unknown',
      platformVersion: this.tg.version || 'unknown',
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportHeight: this.tg.viewportHeight || window.innerHeight,
      viewportStableHeight: this.tg.viewportStableHeight || window.innerHeight,
      viewportWidth: this.tg.viewportWidth || window.innerWidth,
      colorScheme: this.tg.colorScheme || 'light',
      themeParams: {
        bg_color: this.tg.themeParams?.bg_color,
        text_color: this.tg.themeParams?.text_color,
        hint_color: this.tg.themeParams?.hint_color,
        link_color: this.tg.themeParams?.link_color,
        button_color: this.tg.themeParams?.button_color,
        button_text_color: this.tg.themeParams?.button_text_color,
        secondary_bg_color: this.tg.themeParams?.secondary_bg_color,
      }
    };
  }

  /**
   * Check which advanced features are available
   */
  private async checkAvailableFeatures(): Promise<void> {
    // Check biometric authentication
    if (this.tg.BiometricManager) {
      try {
        this.biometricAvailable = await this.tg.BiometricManager.isAvailable();
      } catch (error) {
        console.log('Biometric authentication not available');
      }
    }

    // Check location services
    if (this.tg.LocationManager) {
      try {
        this.locationAvailable = await this.tg.LocationManager.isAvailable();
      } catch (error) {
        console.log('Location services not available');
      }
    }

    // Check contacts access
    if (this.tg.ContactsManager) {
      try {
        this.contactsAvailable = await this.tg.ContactsManager.isAvailable();
      } catch (error) {
        console.log('Contacts access not available');
      }
    }
  }

  /**
   * Setup event listeners for Telegram WebApp events
   */
  private setupEventListeners(): void {
    // Viewport changes
    this.tg.onEvent('viewportChanged', () => {
      this.deviceInfo.viewportHeight = this.tg.viewportHeight;
      this.deviceInfo.viewportWidth = this.tg.viewportWidth;
      this.optimizeForDevice();
    });

    // Theme changes
    this.tg.onEvent('themeChanged', () => {
      this.deviceInfo.themeParams = { ...this.deviceInfo.themeParams, ...this.tg.themeParams };
      this.applyTheme();
    });

    // Main button clicked
    this.tg.onEvent('mainButtonClicked', () => {
      this.handleMainButtonClick();
    });

    // Back button clicked
    this.tg.onEvent('backButtonClicked', () => {
      this.handleBackButtonClick();
    });

    // App state changes
    this.tg.onEvent('invoiceClosed', (data: any) => {
      this.handleInvoiceClosed(data);
    });

    // Popup closed
    this.tg.onEvent('popupClosed', (data: any) => {
      this.handlePopupClosed(data);
    });

    // QR text received
    this.tg.onEvent('qrTextReceived', (data: any) => {
      this.handleQRTextReceived(data);
    });

    // Clipboard text received
    this.tg.onEvent('clipboardTextReceived', (data: any) => {
      this.handleClipboardTextReceived(data);
    });

    // Online status changes
    window.addEventListener('online', () => this.handleOnlineStatusChange(true));
    window.addEventListener('offline', () => this.handleOnlineStatusChange(false));
  }

  /**
   * Optimize UI for specific device
   */
  private optimizeForDevice(): void {
    const { viewportHeight, viewportStableHeight, devicePixelRatio } = this.deviceInfo;

    // Set CSS custom properties for responsive design
    document.documentElement.style.setProperty('--vh', `${viewportStableHeight * 0.01}px`);
    document.documentElement.style.setProperty('--vw', `${this.deviceInfo.viewportWidth * 0.01}px`);

    // Handle safe area for notched devices
    const safeAreaTop = this.getSafeAreaInset('top');
    const safeAreaBottom = this.getSafeAreaInset('bottom');

    document.documentElement.style.setProperty('--safe-area-top', `${safeAreaTop}px`);
    document.documentElement.style.setProperty('--safe-area-bottom', `${safeAreaBottom}px`);

    // Adjust for high DPI displays
    if (devicePixelRatio && devicePixelRatio > 2) {
      document.body.classList.add('high-dpi');
    }

    // Apply platform-specific classes
    document.body.classList.add(`platform-${this.deviceInfo.platform.toLowerCase()}`);
    document.body.classList.add(this.deviceInfo.colorScheme);
  }

  /**
   * Get safe area insets for notched devices
   */
  private getSafeAreaInset(edge: 'top' | 'bottom' | 'left' | 'right'): number {
    const computedStyle = getComputedStyle(document.documentElement);
    const value = computedStyle.getPropertyValue(`--safe-area-inset-${edge}`);
    return parseInt(value) || 0;
  }

  /**
   * Apply Telegram theme to the app
   */
  private applyTheme(): void {
    const root = document.documentElement;
    const theme = this.deviceInfo.themeParams;

    if (theme.bg_color) root.style.setProperty('--tg-theme-bg-color', theme.bg_color);
    if (theme.text_color) root.style.setProperty('--tg-theme-text-color', theme.text_color);
    if (theme.hint_color) root.style.setProperty('--tg-theme-hint-color', theme.hint_color);
    if (theme.link_color) root.style.setProperty('--tg-theme-link-color', theme.link_color);
    if (theme.button_color) root.style.setProperty('--tg-theme-button-color', theme.button_color);
    if (theme.button_text_color) root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
    if (theme.secondary_bg_color) root.style.setProperty('--tg-theme-secondary-bg-color', theme.secondary_bg_color);
  }

  /**
   * Enable biometric authentication
   */
  async enableBiometricAuth(request: BiometricAuthRequest): Promise<boolean> {
    if (!this.biometricAvailable || !this.tg.BiometricManager) {
      return false;
    }

    try {
      const result = await this.tg.BiometricManager.authenticate({
        reason: request.reason,
        prompt: request.prompt || 'Confirm your identity'
      });

      return result.status === 'authorized';
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  /**
   * Request access to device location
   */
  async requestLocationAccess(): Promise<LocationData | null> {
    if (!this.locationAvailable || !this.tg.LocationManager) {
      return null;
    }

    try {
      await this.tg.LocationManager.requestLocation();

      return new Promise((resolve) => {
        this.tg.LocationManager.onLocationUpdate((location: LocationData) => {
          resolve(location);
        });
      });
    } catch (error) {
      console.error('Location access failed:', error);
      return null;
    }
  }

  /**
   * Request access to contacts
   */
  async requestContactsAccess(): Promise<ContactData | null> {
    if (!this.contactsAvailable || !this.tg.ContactsManager) {
      return null;
    }

    try {
      await this.tg.ContactsManager.requestContacts();

      return new Promise((resolve) => {
        this.tg.ContactsManager.onContactSelected((contact: ContactData) => {
          resolve(contact);
        });
      });
    } catch (error) {
      console.error('Contacts access failed:', error);
      return null;
    }
  }

  /**
   * Save files to device storage
   */
  async saveFiles(files: File[]): Promise<boolean[]> {
    if (!this.tg.requestWriteAccess) {
      console.error('File saving not supported');
      return files.map(() => false);
    }

    try {
      await this.tg.requestWriteAccess();
      const results: boolean[] = [];

      for (const file of files) {
        try {
          const saved = await this.tg.saveFile(file);
          results.push(!!saved);

          if (saved) {
            this.showNotification('File Saved', `${file.name} saved successfully`);
          }
        } catch (error) {
          console.error(`Failed to save file ${file.name}:`, error);
          results.push(false);
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to get write access:', error);
      return files.map(() => false);
    }
  }

  /**
   * Schedule a notification
   */
  async scheduleNotification(notification: NotificationSchedule): Promise<void> {
    const notificationData = {
      ...notification,
      created: Date.now(),
      type: 'scheduled'
    };

    // Save to cloud storage
    if (this.tg.CloudStorage) {
      await this.tg.CloudStorage.setItem(
        `notification_${notification.id}`,
        JSON.stringify(notificationData)
      );
    }

    // Also save to local storage as backup
    if ('localStorage' in window) {
      localStorage.setItem(`notification_${notification.id}`, JSON.stringify(notificationData));
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    if (this.tg.CloudStorage) {
      await this.tg.CloudStorage.removeItem(`notification_${notificationId}`);
    }

    if ('localStorage' in window) {
      localStorage.removeItem(`notification_${notificationId}`);
    }
  }

  /**
   * Show a native popup
   */
  showPopup(title: string, message: string, buttons?: Array<{ text: string; type?: string }>): Promise<string> {
    const defaultButtons = [
      { text: 'OK', type: 'default' }
    ];

    return new Promise((resolve) => {
      this.tg.showPopup({
        title,
        message,
        buttons: buttons || defaultButtons
      }, (buttonId: string) => {
        resolve(buttonId);
      });
    });
  }

  /**
   * Show a confirmation dialog
   */
  showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.tg.showConfirm(message, (confirmed: boolean) => {
        resolve(confirmed);
      });
    });
  }

  /**
   * Show an alert
   */
  showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      this.tg.showAlert(message, () => {
        resolve();
      });
    });
  }

  /**
   * Show a native notification
   */
  showNotification(title: string, body: string, options?: any): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'labelmint-notification',
        ...options
      });
    } else {
      // Fallback to Telegram popup
      this.showPopup(title, body);
    }
  }

  /**
   * Request permission for notifications
   */
  async requestNotificationPermission(): Promise<boolean> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  /**
   * Read QR code using camera
   */
  async scanQRCode(): Promise<string | null> {
    if (!this.tg.scanQrCode) {
      return null;
    }

    return new Promise((resolve) => {
      this.tg.scanQrCode((text: string) => {
        resolve(text);
      });
    });
  }

  /**
   * Read text from clipboard
   */
  async readFromClipboard(): Promise<string | null> {
    if (!this.tg.readTextFromClipboard) {
      return null;
    }

    return new Promise((resolve) => {
      this.tg.readTextFromClipboard((text: string) => {
        resolve(text);
      });
    });
  }

  /**
   * Share content with other apps
   */
  async shareContent(text: string, url?: string): Promise<boolean> {
    if (!this.tg.shareData) {
      return false;
    }

    try {
      await this.tg.shareData({
        text,
        url
      });
      return true;
    } catch (error) {
      console.error('Share failed:', error);
      return false;
    }
  }

  /**
   * Open a link in Telegram's in-app browser
   */
  openLink(url: string, options?: { try_instant_view?: boolean }): void {
    this.tg.openLink(url, options);
  }

  /**
   * Open a Telegram internal link
   */
  openTelegramLink(url: string): void {
    this.tg.openTelegramLink(url);
  }

  /**
   * Close the WebApp
   */
  close(): void {
    this.tg.close();
  }

  /**
   * Send data back to the bot
   */
  sendData(data: any): void {
    this.tg.sendData(JSON.stringify(data));
  }

  /**
   * Configure the main button
   */
  setMainButton(text: string, onClick: () => void, color?: string, textColor?: string): void {
    this.tg.MainButton.setText(text);
    if (color) this.tg.MainButton.setColor(color);
    if (textColor) this.tg.MainButton.setTextColor(textColor);
    this.tg.MainButton.onClick(onClick);
    this.tg.MainButton.show();
  }

  /**
   * Hide the main button
   */
  hideMainButton(): void {
    this.tg.MainButton.hide();
  }

  /**
   * Show the back button
   */
  showBackButton(onClick: () => void): void {
    this.tg.BackButton.onClick(onClick);
    this.tg.BackButton.show();
  }

  /**
   * Hide the back button
   */
  hideBackButton(): void {
    this.tg.BackButton.hide();
  }

  /**
   * Enable haptic feedback
   */
  triggerHapticFeedback(type: 'impact' | 'notification' | 'selection', style?: string): void {
    if (!this.tg.HapticFeedback) return;

    switch (type) {
      case 'impact':
        this.tg.HapticFeedback.impactOccurred(style || 'medium');
        break;
      case 'notification':
        this.tg.HapticFeedback.notificationOccurred(style || 'success');
        break;
      case 'selection':
        this.tg.HapticFeedback.selectionChanged();
        break;
    }
  }

  /**
   * Get current device info
   */
  getDeviceInfo(): DeviceInfo {
    return this.deviceInfo;
  }

  /**
   * Check if WebApp is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if app is in offline mode
   */
  isOffline(): boolean {
    return !navigator.onLine;
  }

  /**
   * Queue actions for when online
   */
  queueOfflineAction(type: string, data: any): void {
    this.offlineQueue.push({ type, data, timestamp: Date.now() });

    // Save to localStorage for persistence
    localStorage.setItem('offlineQueue', JSON.stringify(this.offlineQueue));
  }

  /**
   * Process queued offline actions
   */
  async processOfflineQueue(): Promise<void> {
    if (!navigator.onLine || this.offlineQueue.length === 0) return;

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    localStorage.removeItem('offlineQueue');

    for (const action of queue) {
      try {
        await this.processQueuedAction(action);
      } catch (error) {
        console.error('Failed to process queued action:', error);
        // Re-queue failed actions
        this.offlineQueue.push(action);
      }
    }
  }

  /**
   * Process individual queued action
   */
  private async processQueuedAction(action: { type: string; data: any }): Promise<void> {
    // Implementation depends on action type
    console.log('Processing queued action:', action);
  }

  // Event handlers
  private handleMainButtonClick(): void {
    console.log('Main button clicked');
  }

  private handleBackButtonClick(): void {
    console.log('Back button clicked');
    window.history.back();
  }

  private handleInvoiceClosed(data: any): void {
    console.log('Invoice closed:', data);
  }

  private handlePopupClosed(data: any): void {
    console.log('Popup closed:', data);
  }

  private handleQRTextReceived(data: any): void {
    console.log('QR text received:', data);
  }

  private handleClipboardTextReceived(data: any): void {
    console.log('Clipboard text received:', data);
  }

  private handleOnlineStatusChange(isOnline: boolean): void {
    console.log('Online status changed:', isOnline);

    if (isOnline) {
      this.processOfflineQueue();
    }

    // Notify the app
    window.dispatchEvent(new CustomEvent('onlineStatusChanged', { detail: { isOnline } }));
  }
}

// Export singleton instance
export const telegramEnhanced = new TelegramWebAppEnhanced();

// Export types for TypeScript users
export type { BiometricAuthRequest, LocationData, ContactData, FileData, NotificationSchedule };

// Make available globally for easy access
if (typeof window !== 'undefined') {
  window.LabelMintTelegram = telegramEnhanced;
}

// TypeScript declaration for global
declare global {
  interface Window {
    Telegram?: any;
    LabelMintTelegram?: TelegramWebAppEnhanced;
  }
}