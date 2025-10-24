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
}

export const telegramService = new TelegramService();
export default telegramService;