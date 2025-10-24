// Internationalization utilities for LabelMint

export interface Locale {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  currency: string;
}

export interface Translation {
  [key: string]: string | Translation;
}

export interface I18nConfig {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale: string;
  loadLocale: (locale: string) => Promise<Translation>;
}

// Supported locales
export const supportedLocales: Locale[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currency: 'EUR',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currency: 'EUR',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    dateFormat: 'DD.MM.YYYY',
    currency: 'EUR',
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currency: 'EUR',
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currency: 'BRL',
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    direction: 'ltr',
    dateFormat: 'DD.MM.YYYY',
    currency: 'RUB',
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    direction: 'ltr',
    dateFormat: 'YYYY/MM/DD',
    currency: 'CNY',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    dateFormat: 'YYYY/MM/DD',
    currency: 'JPY',
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    direction: 'ltr',
    dateFormat: 'YYYY/MM/DD',
    currency: 'KRW',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    dateFormat: 'DD/MM/YYYY',
    currency: 'SAR',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currency: 'INR',
  },
];

// Default translations (English)
export const defaultTranslations: Translation = {
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    submit: 'Submit',
    reset: 'Reset',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    refresh: 'Refresh',
    retry: 'Retry',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
  },
  navigation: {
    home: 'Home',
    tasks: 'Tasks',
    earnings: 'Earnings',
    profile: 'Profile',
    settings: 'Settings',
    help: 'Help',
    about: 'About',
    logout: 'Logout',
  },
  auth: {
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    resetPassword: 'Reset Password',
    createAccount: 'Create Account',
    alreadyHaveAccount: 'Already have an account?',
    dontHaveAccount: "Don't have an account?",
    loginWithTelegram: 'Login with Telegram',
    connectWallet: 'Connect Wallet',
  },
  tasks: {
    title: 'Tasks',
    availableTasks: 'Available Tasks',
    completedTasks: 'Completed Tasks',
    taskDescription: 'Task Description',
    instructions: 'Instructions',
    submitAnswer: 'Submit Answer',
    skipTask: 'Skip Task',
    timeRemaining: 'Time Remaining',
    points: 'Points',
    difficulty: 'Difficulty',
    category: 'Category',
    estimatedTime: 'Estimated Time',
    startTask: 'Start Task',
    taskCompleted: 'Task Completed',
    taskSkipped: 'Task Skipped',
    noTasksAvailable: 'No tasks available at the moment',
    taskSubmitted: 'Task submitted successfully',
    taskSubmissionFailed: 'Task submission failed',
  },
  earnings: {
    title: 'Earnings',
    totalEarnings: 'Total Earnings',
    availableBalance: 'Available Balance',
    pendingWithdrawals: 'Pending Withdrawals',
    transactionHistory: 'Transaction History',
    withdraw: 'Withdraw',
    deposit: 'Deposit',
    balance: 'Balance',
    earned: 'Earned',
    withdrawn: 'Withdrawn',
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
  },
  wallet: {
    connectWallet: 'Connect Wallet',
    disconnectWallet: 'Disconnect Wallet',
    walletAddress: 'Wallet Address',
    balance: 'Balance',
    send: 'Send',
    receive: 'Receive',
    transactionHistory: 'Transaction History',
    walletConnected: 'Wallet Connected',
    walletDisconnected: 'Wallet Disconnected',
    insufficientBalance: 'Insufficient Balance',
    transactionPending: 'Transaction Pending',
    transactionConfirmed: 'Transaction Confirmed',
    transactionFailed: 'Transaction Failed',
  },
  profile: {
    title: 'Profile',
    personalInfo: 'Personal Information',
    accountSettings: 'Account Settings',
    preferences: 'Preferences',
    notifications: 'Notifications',
    privacy: 'Privacy',
    security: 'Security',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    country: 'Country',
    language: 'Language',
    timezone: 'Timezone',
    saveChanges: 'Save Changes',
    profileUpdated: 'Profile updated successfully',
  },
  notifications: {
    title: 'Notifications',
    newTask: 'New Task Available',
    taskCompleted: 'Task Completed',
    paymentReceived: 'Payment Received',
    systemUpdate: 'System Update',
    markAsRead: 'Mark as Read',
    markAllAsRead: 'Mark All as Read',
    clearAll: 'Clear All',
    noNotifications: 'No notifications',
  },
  errors: {
    networkError: 'Network error. Please check your connection.',
    serverError: 'Server error. Please try again later.',
    validationError: 'Please check your input and try again.',
    authenticationError: 'Authentication failed. Please login again.',
    authorizationError: 'You do not have permission to perform this action.',
    notFound: 'The requested resource was not found.',
    timeout: 'Request timeout. Please try again.',
    unknownError: 'An unknown error occurred.',
    tryAgain: 'Try Again',
    contactSupport: 'Contact Support',
  },
  success: {
    taskCompleted: 'Task completed successfully!',
    paymentSent: 'Payment sent successfully!',
    profileUpdated: 'Profile updated successfully!',
    settingsSaved: 'Settings saved successfully!',
    walletConnected: 'Wallet connected successfully!',
    withdrawalRequested: 'Withdrawal requested successfully!',
  },
  validation: {
    required: 'This field is required',
    email: 'Please enter a valid email address',
    password: 'Password must be at least 8 characters',
    confirmPassword: 'Passwords do not match',
    minLength: 'Must be at least {min} characters',
    maxLength: 'Must be no more than {max} characters',
    numeric: 'Must be a number',
    positive: 'Must be a positive number',
    url: 'Please enter a valid URL',
    phone: 'Please enter a valid phone number',
  },
  time: {
    now: 'Now',
    minutes: 'Minutes',
    hours: 'Hours',
    days: 'Days',
    weeks: 'Weeks',
    months: 'Months',
    years: 'Years',
    ago: 'ago',
    in: 'in',
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
  },
  currency: {
    symbol: '$',
    format: '{amount} {symbol}',
    decimal: '.',
    thousand: ',',
  },
};

// I18n class
export class I18n {
  private currentLocale: string;
  private translations: Translation = {};
  private config: I18nConfig;
  private listeners: Set<() => void> = new Set();

  constructor(config: I18nConfig) {
    this.config = config;
    this.currentLocale = config.defaultLocale;
    this.translations = defaultTranslations;
  }

  // Initialize with locale
  async init(locale?: string): Promise<void> {
    const targetLocale = locale || this.detectLocale() || this.config.defaultLocale;
    await this.setLocale(targetLocale);
  }

  // Set current locale
  async setLocale(locale: string): Promise<void> {
    if (this.currentLocale === locale) return;

    try {
      const translations = await this.config.loadLocale(locale);
      this.currentLocale = locale;
      this.translations = { ...defaultTranslations, ...translations };
      
      // Update document attributes
      document.documentElement.lang = locale;
      document.documentElement.dir = this.getLocaleDirection(locale);
      
      // Notify listeners
      this.notifyListeners();
    } catch (error) {
      console.error(`Failed to load locale ${locale}:`, error);
      // Fallback to default locale
      if (locale !== this.config.fallbackLocale) {
        await this.setLocale(this.config.fallbackLocale);
      }
    }
  }

  // Get current locale
  getCurrentLocale(): string {
    return this.currentLocale;
  }

  // Detect user's preferred locale
  detectLocale(): string | null {
    // Check localStorage
    const stored = localStorage.getItem('preferred-locale');
    if (stored && this.config.supportedLocales.includes(stored)) {
      return stored;
    }

    // Check browser language
    const browserLang = navigator.language.split('-')[0];
    if (this.config.supportedLocales.includes(browserLang)) {
      return browserLang;
    }

    // Check navigator.languages
    for (const lang of navigator.languages) {
      const code = lang.split('-')[0];
      if (this.config.supportedLocales.includes(code)) {
        return code;
      }
    }

    return null;
  }

  // Get locale direction
  getLocaleDirection(locale: string): 'ltr' | 'rtl' {
    const localeInfo = supportedLocales.find(l => l.code === locale);
    return localeInfo?.direction || 'ltr';
  }

  // Translate a key
  t(key: string, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = this.translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to default translations
        value = defaultTranslations;
        for (const k2 of keys) {
          if (value && typeof value === 'object' && k2 in value) {
            value = value[k2];
          } else {
            return key; // Return key if translation not found
          }
        }
        break;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace parameters
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, param) => {
        return params[param] || match;
      });
    }

    return value;
  }

  // Pluralize translation
  tPlural(key: string, count: number, params?: Record<string, any>): string {
    const pluralKey = count === 1 ? `${key}.one` : `${key}.other`;
    return this.t(pluralKey, { ...params, count });
  }

  // Format number
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.currentLocale, options).format(value);
  }

  // Format currency
  formatCurrency(value: number, currency?: string): string {
    const localeInfo = supportedLocales.find(l => l.code === this.currentLocale);
    const currencyCode = currency || localeInfo?.currency || 'USD';
    
    return new Intl.NumberFormat(this.currentLocale, {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  }

  // Format date
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.currentLocale, options).format(date);
  }

  // Format relative time
  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return this.t('time.now');
    } else if (minutes < 60) {
      return this.tPlural('time.minutes', minutes);
    } else if (hours < 24) {
      return this.tPlural('time.hours', hours);
    } else if (days < 7) {
      return this.tPlural('time.days', days);
    } else {
      return this.formatDate(date);
    }
  }

  // Subscribe to locale changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  // Get supported locales
  getSupportedLocales(): Locale[] {
    return supportedLocales.filter(locale => 
      this.config.supportedLocales.includes(locale.code)
    );
  }

  // Get current locale info
  getCurrentLocaleInfo(): Locale | undefined {
    return supportedLocales.find(l => l.code === this.currentLocale);
  }
}

// Default I18n instance
let defaultI18n: I18n | null = null;

export function initializeI18n(config: I18nConfig): I18n {
  defaultI18n = new I18n(config);
  return defaultI18n;
}

export function getI18n(): I18n {
  if (!defaultI18n) {
    throw new Error('I18n not initialized. Call initializeI18n first.');
  }
  return defaultI18n;
}

export default I18n;
