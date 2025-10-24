// ============================================================================
// USER TYPES
// ============================================================================

export enum UserRole {
  WORKER = 'WORKER',
  CLIENT = 'CLIENT',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export interface User {
  id: string
  telegramId?: bigint
  email?: string
  username?: string
  firstName?: string
  lastName?: string
  languageCode?: string
  isActive: boolean
  role: UserRole
  createdAt: Date
  updatedAt: Date

  // Payment fields
  walletBalance: number
  totalEarned: number
  totalWithdrawn: number
  frozenBalance: number

  // Performance fields
  tasksCompleted: number
  accuracyRate?: number
  trustScore: number
  suspicionScore: number

  // Authentication fields
  passwordHash?: string
  twoFactorSecret?: string
  twoFactorEnabled: boolean
  lastLoginAt?: Date

  // TON Blockchain fields
  tonWalletAddress?: string
  tonWalletVersion?: string
  tonWalletTestnet: boolean

  // Gamification fields
  level: number
  experiencePoints: number
  currentStreak: number
  maxStreak: number
}

export interface UserProfile extends Omit<User, 'passwordHash' | 'twoFactorSecret'> {
  // Additional public profile fields
  displayName?: string
  bio?: string
  avatar?: string
  timezone?: string
  preferences?: UserPreferences
}

export interface UserPreferences {
  language: string
  notifications: NotificationPreferences
  privacy: PrivacyPreferences
  work: WorkPreferences
}

export interface NotificationPreferences {
  email: boolean
  push: boolean
  telegram: boolean
  taskUpdates: boolean
  paymentUpdates: boolean
  systemUpdates: boolean
}

export interface PrivacyPreferences {
  showProfile: boolean
  showStats: boolean
  showAchievements: boolean
  allowDirectMessages: boolean
}

export interface WorkPreferences {
  maxTasksPerDay: number
  preferredTaskTypes: string[]
  workingHours: {
    start: string
    end: string
    timezone: string
  }
  autoAcceptTasks: boolean
}

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterCredentials {
  email: string
  password: string
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
  referralCode?: string
}

export interface TelegramAuthData {
  id: bigint
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export interface TwoFactorSetup {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

export interface AuthSession {
  id: string
  userId: string
  deviceInfo: DeviceInfo
  ipAddress: string
  userAgent: string
  isActive: boolean
  lastAccessedAt: Date
  expiresAt: Date
}

export interface DeviceInfo {
  deviceId: string
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'bot'
  platform: string
  browser?: string
  version?: string
  trusted: boolean
}

// ============================================================================
// WORKER PERFORMANCE TYPES
// ============================================================================

export interface WorkerStats {
  userId: string
  tasksCompleted: number
  accuracyRate: number
  averageTimePerTask: number // in seconds
  earnings: {
    total: number
    weekly: number
    daily: number
  }
  rank: number
  level: number
  streak: {
    current: number
    best: number
  }
  warningCount: number
  lastActiveAt: Date
}

export interface WorkerQualityMetrics {
  accuracy: number
  consistency: number
  speed: number
  reliability: number
  overall: number
  breakdown: {
    labelAccuracy: number
    boundaryPrecision: number
    transcriptionAccuracy: number
    sentimentAccuracy: number
  }
}

export interface WorkerWarning {
  id: string
  type: WarningType
  reason: string
  severity: WarningSeverity
  expiresAt?: Date
  acknowledged: boolean
  acknowledgedAt?: Date
  createdAt: Date
}

export enum WarningType {
  LOW_ACCURACY = 'LOW_ACCURACY',
  RAPID_SKIPPING = 'RAPID_SKIPPING',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
  VIOLATION = 'VIOLATION',
  TIME_MANAGEMENT = 'TIME_MANAGEMENT'
}

export enum WarningSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// ============================================================================
// ACHIEVEMENT AND GAMIFICATION TYPES
// ============================================================================

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: string
  points: number
  condition: Record<string, any>
  hidden: boolean
  createdAt: Date
}

export interface UserAchievement {
  id: string
  userId: string
  achievementId: string
  progress: number
  completedAt?: Date
  createdAt: Date
  achievement: Achievement
}

export interface Level {
  id: string
  level: number
  name: string
  minPoints: number
  rewards?: Record<string, any>
  createdAt: Date
}

export interface UserStreak {
  id: string
  userId: string
  date: Date
  tasksCompleted: number
  bonusEarned: number
  createdAt: Date
}

export interface Referral {
  id: string
  referrerId: string
  referredId?: string
  code: string
  status: ReferralStatus
  rewardAmount?: number
  completedAt?: Date
  createdAt: Date
}

export enum ReferralStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}