import WebApp from '@twa-dev/sdk';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramInitData {
  query_id?: string;
  user?: TelegramUser;
  auth_date?: string;
  hash?: string;
}

class TelegramService {
  private webApp: typeof WebApp;
  private user: TelegramUser | null = null;
  private initData: TelegramInitData | null = null;

  constructor() {
    this.webApp = WebApp;
  }

  init() {
    this.webApp.ready();
    this.webApp.expand();
    this.webApp.enableClosingConfirmation();

    // Parse init data
    try {
      const initDataRaw = this.webApp.initData;
      if (initDataRaw) {
        const urlParams = new URLSearchParams(initDataRaw);
        const userStr = urlParams.get('user');

        if (userStr) {
          this.user = JSON.parse(decodeURIComponent(userStr));
        }

        this.initData = {
          query_id: urlParams.get('query_id') || undefined,
          user: this.user,
          auth_date: urlParams.get('auth_date') || undefined,
          hash: urlParams.get('hash') || undefined,
        };
      }
    } catch (error) {
      console.error('Error parsing Telegram init data:', error);
    }

    // Set theme
    this.updateTheme();

    // Handle theme changes
    this.webApp.onEvent('themeChanged', this.updateTheme.bind(this));

    // Handle viewport changes
    this.webApp.onEvent('viewportChanged', this.handleViewportChanged.bind(this));
  }

  private updateTheme() {
    const colorScheme = this.webApp.colorScheme;
    document.documentElement.setAttribute('data-theme', colorScheme);

    // Update CSS variables
    const root = document.documentElement;
    if (colorScheme === 'dark') {
      root.style.setProperty('--bg-color', '#18212d');
      root.style.setProperty('--text-color', '#ffffff');
      root.style.setProperty('--card-bg', '#1f2937');
      root.style.setProperty('--border-color', '#374151');
    } else {
      root.style.setProperty('--bg-color', '#ffffff');
      root.style.setProperty('--text-color', '#000000');
      root.style.setProperty('--card-bg', '#f3f4f6');
      root.style.setProperty('--border-color', '#e5e7eb');
    }
  }

  private handleViewportChanged() {
    // Handle viewport changes if needed
  }

  getUser(): TelegramUser | null {
    return this.user;
  }

  getInitData(): TelegramInitData | null {
    return this.initData;
  }

  getUserId(): number | null {
    return this.user?.id || null;
  }

  isAuthenticated(): boolean {
    return !!this.user;
  }

  // Haptic feedback
  hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
    if (this.webApp.HapticFeedback) {
      this.webApp.HapticFeedback.impactOccurred(style);
    }
  }

  hapticNotification(type: 'error' | 'success' | 'warning') {
    if (this.webApp.HapticFeedback) {
      this.webApp.HapticFeedback.notificationOccurred(type);
    }
  }

  hapticSelection() {
    if (this.webApp.HapticFeedback) {
      this.webApp.HapticFeedback.selectionChanged();
    }
  }

  // Show popup
  showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      this.webApp.showAlert(message, resolve);
    });
  }

  showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.webApp.showConfirm(message, (confirmed) => resolve(confirmed));
    });
  }

  // Main button
  setMainButton(text: string, onClick: () => void, visible: boolean = true, active: boolean = true) {
    this.webApp.MainButton.setText(text);
    this.webApp.MainButton.onClick(onClick);

    if (visible) {
      this.webApp.MainButton.show();
    } else {
      this.webApp.MainButton.hide();
    }

    this.webApp.MainButton.enable(active);
  }

  hideMainButton() {
    this.webApp.MainButton.hide();
  }

  // Back button
  showBackButton(onClick: () => void) {
    this.webApp.BackButton.onClick(onClick);
    this.webApp.BackButton.show();
  }

  hideBackButton() {
    this.webApp.BackButton.hide();
  }

  // Close app
  close() {
    this.webApp.close();
  }

  // Ready method to signal to Telegram
  ready() {
    this.webApp.ready();
  }

  // Share functionality
  openTelegramLink(url: string) {
    this.webApp.openTelegramLink(url);
  }

  openLink(url: string, options?: { try_instant_view?: boolean }) {
    this.webApp.openLink(url, options);
  }

  // Sharing and invite
  shareLink(url: string, text?: string) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
    this.openTelegramLink(shareUrl);
  }

  shareToStory(mediaUrl: string, options?: {
    text?: string;
    widget_link?: { url: string; name: string };
  }) {
    // Telegram Stories API (available in newer versions)
    if ((this.webApp as any).shareToStory) {
      (this.webApp as any).shareToStory(mediaUrl, options);
    }
  }

  // Cloud storage (Telegram Cloud)
  async setCloudStorage(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.webApp.CloudStorage) {
        this.webApp.CloudStorage.setItem(key, value, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('CloudStorage not available'));
      }
    });
  }

  async getCloudStorage(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (this.webApp.CloudStorage) {
        this.webApp.CloudStorage.getItem(key, (error, value) => {
          if (error) {
            reject(error);
          } else {
            resolve(value || null);
          }
        });
      } else {
        reject(new Error('CloudStorage not available'));
      }
    });
  }

  async removeCloudStorage(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.webApp.CloudStorage) {
        this.webApp.CloudStorage.removeItem(key, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('CloudStorage not available'));
      }
    });
  }

  // Biometric authentication
  async requestBiometricAuth(reason?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if ((this.webApp as any).BiometricManager) {
        const biometric = (this.webApp as any).BiometricManager;
        
        if (!biometric.isInited) {
          biometric.init();
        }

        if (!biometric.isBiometricAvailable) {
          reject(new Error('Biometric authentication not available'));
          return;
        }

        biometric.authenticate({ reason }, (success: boolean) => {
          resolve(success);
        });
      } else {
        reject(new Error('BiometricManager not available'));
      }
    });
  }

  // QR Code scanner
  async scanQRCode(text?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.webApp.showScanQrPopup) {
        this.webApp.showScanQrPopup({ text }, (data) => {
          if (data) {
            this.webApp.closeScanQrPopup();
            resolve(data);
          } else {
            reject(new Error('QR scan cancelled'));
          }
        });
      } else {
        reject(new Error('QR scanner not available'));
      }
    });
  }

  // Clipboard
  async readClipboard(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.webApp.readTextFromClipboard) {
        this.webApp.readTextFromClipboard((text) => {
          resolve(text || '');
        });
      } else {
        reject(new Error('Clipboard read not available'));
      }
    });
  }

  // Request contact / phone
  async requestContact(): Promise<{ phone_number: string; first_name: string; last_name?: string; user_id?: number }> {
    return new Promise((resolve, reject) => {
      if ((this.webApp as any).requestContact) {
        (this.webApp as any).requestContact((contact: any) => {
          if (contact) {
            resolve(contact);
          } else {
            reject(new Error('Contact request cancelled'));
          }
        });
      } else {
        reject(new Error('Contact request not available'));
      }
    });
  }

  // Request write access for bot
  async requestWriteAccess(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.webApp.requestWriteAccess) {
        this.webApp.requestWriteAccess((granted) => {
          resolve(granted);
        });
      } else {
        resolve(false);
      }
    });
  }

  // Switch inline query (for sharing to chats)
  switchInlineQuery(query: string, chatTypes?: Array<'users' | 'bots' | 'groups' | 'channels'>) {
    if (this.webApp.switchInlineQuery) {
      this.webApp.switchInlineQuery(query, chatTypes);
    }
  }

  // Send data to bot
  sendData(data: string) {
    if (this.webApp.sendData) {
      this.webApp.sendData(data);
    }
  }

  // Platform detection
  getPlatform(): string {
    return this.webApp.platform;
  }

  getVersion(): string {
    return this.webApp.version;
  }

  isVersionAtLeast(version: string): boolean {
    return this.webApp.isVersionAtLeast(version);
  }

  // Theme colors
  getThemeParams() {
    return this.webApp.themeParams;
  }

  getHeaderColor(): string {
    return this.webApp.headerColor;
  }

  setHeaderColor(color: string) {
    if (this.webApp.setHeaderColor) {
      this.webApp.setHeaderColor(color);
    }
  }

  getBackgroundColor(): string {
    return this.webApp.backgroundColor;
  }

  setBackgroundColor(color: string) {
    if (this.webApp.setBackgroundColor) {
      this.webApp.setBackgroundColor(color);
    }
  }

  // Viewport info
  getViewportHeight(): number {
    return this.webApp.viewportHeight;
  }

  getViewportStableHeight(): number {
    return this.webApp.viewportStableHeight;
  }

  isExpanded(): boolean {
    return this.webApp.isExpanded;
  }

  // Settings button (for additional options)
  showSettingsButton(onClick: () => void) {
    if ((this.webApp as any).SettingsButton) {
      (this.webApp as any).SettingsButton.onClick(onClick);
      (this.webApp as any).SettingsButton.show();
    }
  }

  hideSettingsButton() {
    if ((this.webApp as any).SettingsButton) {
      (this.webApp as any).SettingsButton.hide();
    }
  }

  // Download file (if supported)
  async downloadFile(url: string, filename: string): Promise<boolean> {
    return new Promise((resolve) => {
      if ((this.webApp as any).downloadFile) {
        (this.webApp as any).downloadFile({ url, file_name: filename }, (success: boolean) => {
          resolve(success);
        });
      } else {
        resolve(false);
      }
    });
  }
}

export const telegramService = new TelegramService();
export default telegramService;