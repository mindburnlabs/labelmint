import { useTWA } from '@twa-dev/sdk/react';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    chat_instance?: string;
    chat_type?: string;
    auth_date?: number;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  CloudStorage: {
    setItem: (key: string, value: string, callback?: (error: string | null, result?: boolean) => void) => void;
    getItem: (key: string, callback: (error: string | null, result?: string) => void) => void;
    getItems: (keys: string[], callback: (error: string | null, result?: Record<string, string>) => void) => void;
    removeItem: (key: string, callback?: (error: string | null, result?: boolean) => void) => void;
    removeItems: (keys: string[], callback?: (error: string | null, result?: boolean) => void) => void;
    getKeys: (callback: (error: string | null, result?: string[]) => void) => void;
  };
  BiometricManager: {
    isBiometricAvailable: boolean;
    isBiometricTokenSaved: boolean;
    isBiometricEnabled: boolean;
    biometricType: 'finger' | 'face' | 'unknown';
    requestAccess: (reason?: string) => Promise<boolean>;
    authenticate: (reason?: string) => Promise<boolean>;
    updateBiometricToken: (token: string) => Promise<boolean>;
    openSettings: () => void;
  };
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text?: string;
    }>;
  }, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup: (params: {
    text?: string;
  }, callback?: (text: string) => void) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string) => void) => void;
  requestWriteAccess: (callback?: (granted: boolean) => void) => void;
  requestContact: (callback?: (granted: boolean, contact?: {
    contact: {
      phone_number: string;
      first_name: string;
      last_name?: string;
      user_id?: number;
    };
  }) => void) => void;
  ready: () => void;
  expand: () => void;
  close: () => void;
  sendData: (data: any) => void;
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
}

export class TelegramService {
  private webApp: TelegramWebApp | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      this.webApp = (window as any).Telegram.WebApp;
      this.webApp.ready();
      this.isInitialized = true;
    }
  }

  /**
   * Get the Telegram WebApp instance
   */
  getWebApp(): TelegramWebApp | null {
    return this.webApp;
  }

  /**
   * Check if the app is running in Telegram
   */
  isInTelegram(): boolean {
    return this.webApp !== null;
  }

  /**
   * Get current user information
   */
  getUser(): TelegramUser | null {
    return this.webApp?.initDataUnsafe?.user || null;
  }

  /**
   * Get user ID
   */
  getUserId(): number | null {
    return this.webApp?.initDataUnsafe?.user?.id || null;
  }

  /**
   * Get user's full name
   */
  getUserFullName(): string {
    const user = this.getUser();
    if (!user) return '';
    return `${user.first_name} ${user.last_name || ''}`.trim();
  }

  /**
   * Get user's username
   */
  getUsername(): string | null {
    return this.webApp?.initDataUnsafe?.user?.username || null;
  }

  /**
   * Get initialization data
   */
  getInitData(): string {
    return this.webApp?.initData || '';
  }

  /**
   * Get theme information
   */
  getTheme(): {
    colorScheme: 'light' | 'dark';
    themeParams: TelegramWebApp['themeParams'];
  } {
    if (!this.webApp) {
      return {
        colorScheme: 'light',
        themeParams: {}
      };
    }

    return {
      colorScheme: this.webApp.colorScheme,
      themeParams: this.webApp.themeParams
    };
  }

  /**
   * Haptic feedback methods
   */
  haptic = {
    impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
      try {
        this.webApp?.HapticFeedback?.impactOccurred(style);
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    },

    notification: (type: 'error' | 'success' | 'warning' = 'success') => {
      try {
        this.webApp?.HapticFeedback?.notificationOccurred(type);
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    },

    selection: () => {
      try {
        this.webApp?.HapticFeedback?.selectionChanged();
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    }
  };

  /**
   * Show alert with haptic feedback
   */
  showAlert(message: string, callback?: () => void): void {
    this.haptic.notification('success');
    this.webApp?.showAlert(message, callback);
  }

  /**
   * Show error alert with haptic feedback
   */
  showError(message: string, callback?: () => void): void {
    this.haptic.notification('error');
    this.webApp?.showAlert(message, callback);
  }

  /**
   * Show confirmation dialog
   */
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void {
    this.webApp?.showConfirm(message, callback);
  }

  /**
   * Show popup with custom buttons
   */
  showPopup(params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text?: string;
    }>;
  }, callback?: (buttonId: string) => void): void {
    this.webApp?.showPopup(params, callback);
  }

  /**
   * Open external link
   */
  openLink(url: string, options?: { try_instant_view?: boolean }): void {
    this.webApp?.openLink(url, options);
  }

  /**
   * Open Telegram link
   */
  openTelegramLink(url: string): void {
    this.webApp?.openTelegramLink(url);
  }

  /**
   * Open invoice
   */
  openInvoice(url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void {
    this.webApp?.openInvoice(url, callback);
  }

  /**
   * Main button controls
   */
  mainButton = {
    setText: (text: string) => {
      this.webApp?.MainButton.setText(text);
    },

    show: () => {
      this.webApp?.MainButton.show();
    },

    hide: () => {
      this.webApp?.MainButton.hide();
    },

    enable: () => {
      this.webApp?.MainButton.enable();
    },

    disable: () => {
      this.webApp?.MainButton.disable();
    },

    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => {
      this.webApp?.MainButton.setParams(params);
    },

    onClick: (callback: () => void) => {
      this.webApp?.MainButton.onClick(callback);
    },

    offClick: (callback: () => void) => {
      this.webApp?.MainButton.offClick(callback);
    }
  };

  /**
   * Back button controls
   */
  backButton = {
    show: () => {
      this.webApp?.BackButton.show();
    },

    hide: () => {
      this.webApp?.BackButton.hide();
    },

    onClick: (callback: () => void) => {
      this.webApp?.BackButton.onClick(callback);
    },

    offClick: (callback: () => void) => {
      this.webApp?.BackButton.offClick(callback);
    }
  };

  /**
   * Cloud storage methods
   */
  storage = {
    set: (key: string, value: string): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        this.webApp?.CloudStorage.setItem(key, value, (error, result) => {
          if (error) {
            reject(new Error(error));
          } else {
            resolve(result || false);
          }
        });
      });
    },

    get: (key: string): Promise<string | null> => {
      return new Promise((resolve, reject) => {
        this.webApp?.CloudStorage.getItem(key, (error, result) => {
          if (error) {
            reject(new Error(error));
          } else {
            resolve(result || null);
          }
        });
      });
    },

    remove: (key: string): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        this.webApp?.CloudStorage.removeItem(key, (error, result) => {
          if (error) {
            reject(new Error(error));
          } else {
            resolve(result || false);
          }
        });
      });
    }
  };

  /**
   * Close the app
   */
  close(): void {
    this.webApp?.close();
  }

  /**
   * Expand the app to full height
   */
  expand(): void {
    this.webApp?.expand();
  }

  /**
   * Send data to bot
   */
  sendData(data: any): void {
    this.webApp?.sendData(data);
  }
}

// Create singleton instance
export const telegramService = new TelegramService();

// Export hook for React components
export function useTelegram() {
  return telegramService;
}
