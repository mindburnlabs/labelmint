import { z } from 'zod';
import { FIELD_CONSTRAINTS } from '../database';

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const UserRoleSchema = z.enum(['WORKER', 'CLIENT', 'ADMIN', 'SUPER_ADMIN']);

export const UserPreferencesSchema = z.object({
  language: z.string().min(2).max(10),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    telegram: z.boolean(),
    taskUpdates: z.boolean(),
    paymentUpdates: z.boolean(),
    systemUpdates: z.boolean()
  }),
  privacy: z.object({
    showProfile: z.boolean(),
    showStats: z.boolean(),
    showAchievements: z.boolean(),
    allowDirectMessages: z.boolean()
  }),
  work: z.object({
    maxTasksPerDay: z.number().min(1).max(100),
    preferredTaskTypes: z.array(z.string()),
    workingHours: z.object({
      start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      timezone: z.string()
    }),
    autoAcceptTasks: z.boolean()
  })
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  telegramId: z.bigint().positive().optional(),
  email: z.string().email().max(FIELD_CONSTRAINTS.EMAIL_MAX_LENGTH).optional(),
  username: z.string()
    .min(3)
    .max(FIELD_CONSTRAINTS.USERNAME_MAX_LENGTH)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .regex(/^[^_]/)
    .regex(/[^_]$/)
    .regex(/^(?!.*__).*$/)
    .optional(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  languageCode: z.string().max(10).optional(),
  isActive: z.boolean(),
  role: UserRoleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),

  // Payment fields
  walletBalance: z.number().min(0),
  totalEarned: z.number().min(0),
  totalWithdrawn: z.number().min(0),
  frozenBalance: z.number().min(0),

  // Performance fields
  tasksCompleted: z.number().min(0),
  accuracyRate: z.number().min(0).max(100).optional(),
  trustScore: z.number().min(0).max(100),
  suspicionScore: z.number().min(0).max(100),

  // Authentication fields
  passwordHash: z.string().optional(),
  twoFactorSecret: z.string().optional(),
  twoFactorEnabled: z.boolean(),
  lastLoginAt: z.date().optional(),

  // TON Blockchain fields
  tonWalletAddress: z.string()
    .length(66)
    .regex(/^(EQ|0Q)[a-fA-F0-9]{64}$/)
    .optional(),
  tonWalletVersion: z.string().optional(),
  tonWalletTestnet: z.boolean(),

  // Gamification fields
  level: z.number().min(1),
  experiencePoints: z.number().min(0),
  currentStreak: z.number().min(0),
  maxStreak: z.number().min(0),

  preferences: UserPreferencesSchema.optional()
});

// ============================================================================
// TASK SCHEMAS
// ============================================================================

export const TaskStatusSchema = z.enum([
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED',
  'EXPIRED'
]);

export const TaskTypeSchema = z.enum([
  'IMAGE_CLASSIFICATION',
  'BOUNDING_BOX',
  'POLYGON_ANNOTATION',
  'SEMANTIC_SEGMENTATION',
  'TEXT_CLASSIFICATION',
  'NAMED_ENTITY_RECOGNITION',
  'TRANSCRIPTION',
  'TRANSLATION',
  'SENTIMENT_ANALYSIS',
  'RLHF_COMPARISON',
  'CUSTOM'
]);

export const ConsensusLevelSchema = z.enum([
  'PENDING',
  'CONFLICTING',
  'AGREED',
  'VALIDATED',
  'REJECTED'
]);

export const TaskDataSchema = z.object({
  // Image-based tasks
  imageUrl: z.string().url().optional(),
  imageMetadata: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    format: z.string(),
    size: z.number().positive()
  }).optional(),

  // Text-based tasks
  text: z.string().max(10000).optional(),
  textMetadata: z.object({
    language: z.string(),
    length: z.number().nonnegative(),
    tokens: z.number().nonnegative()
  }).optional(),

  // Common fields
  context: z.string().max(1000).optional(),
  instructions: z.string().max(2000).optional(),

  // Custom data
  custom: z.record(z.any()).optional()
});

export const TaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  type: TaskTypeSchema,
  subType: z.string().max(50).optional(),
  data: TaskDataSchema,
  options: z.array(z.string()).optional(),
  status: TaskStatusSchema,
  priority: z.number().min(1).max(10),
  assignedTo: z.string().uuid().optional(),
  assignedAt: z.date().optional(),
  completedAt: z.date().optional(),
  dueAt: z.date().optional(),

  // AI and Quality fields
  aiPrelabel: z.string().optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  consensusTarget: z.number().min(1).max(10),
  consensusLevel: ConsensusLevelSchema,
  finalLabel: z.string().optional(),
  qualityScore: z.number().min(0).max(100).optional(),

  // Pricing
  basePrice: z.number().min(0),
  points: z.number().min(0),
  multiplier: z.number().min(0.1).max(10),

  createdAt: z.date(),
  updatedAt: z.date()
});

// ============================================================================
// PROJECT SCHEMAS
// ============================================================================

export const ProjectStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED'
]);

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string()
    .min(3)
    .max(FIELD_CONSTRAINTS.PROJECT_NAME_MAX_LENGTH),
  description: z.string()
    .max(FIELD_CONSTRAINTS.PROJECT_DESCRIPTION_MAX_LENGTH)
    .optional(),
  ownerId: z.string().uuid(),
  status: ProjectStatusSchema,
  budget: z.number().min(0),
  totalSpent: z.number().min(0),
  totalTasks: z.number().min(0),
  completedTasks: z.number().min(0),
  paymentPerTask: z.number().min(0),
  requirements: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const TransactionStatusSchema = z.enum([
  'pending',
  'confirmed',
  'failed'
]);

export const TokenTypeSchema = z.enum([
  'TON',
  'USDT',
  'PAYMENT_CHANNEL'
]);

export const TransactionSchema = z.object({
  hash: z.string().length(66),
  fromAddress: z.string()
    .length(66)
    .regex(/^(EQ|0Q)[a-fA-F0-9]{64}$/),
  toAddress: z.string()
    .length(66)
    .regex(/^(EQ|0Q)[a-fA-F0-9]{64}$/),
  amount: z.string().regex(/^\d+\.?\d*$/),
  tokenType: TokenTypeSchema,
  fee: z.string().regex(/^\d+\.?\d*$/).optional(),
  status: TransactionStatusSchema,
  message: z.string().max(200).optional(),
  timestamp: z.date(),
  blockNumber: z.number().positive().optional()
});

export const PaymentRequestSchema = z.object({
  type: TokenTypeSchema,
  fromAddress: z.string()
    .length(66)
    .regex(/^(EQ|0Q)[a-fA-F0-9]{64}$/),
  toAddress: z.string()
    .length(66)
    .regex(/^(EQ|0Q)[a-fA-F0-9]{64}$/),
  amount: z.number().positive(),
  userId: z.string().uuid().optional(),
  message: z.string().max(200).optional(),
  options: z.object({
    message: z.string().max(200).optional(),
    fee: z.number().positive().optional(),
    timeout: z.number().positive().optional(),
    skipValidation: z.boolean().optional()
  }).optional()
});

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).optional()
});

export const SortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('desc')
});

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  }).optional()
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export const createPaginationSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number()
    })
  });

export const createFilterSchema = <T extends Record<string, z.ZodTypeAny>>(filters: T) =>
  z.object(filters).partial().optional();

export const createSearchSchema = () =>
  z.object({
    query: z.string().min(1).max(100),
    fields: z.array(z.string()).optional()
  });

// ============================================================================
// TELEGRAM SCHEMAS
// ============================================================================

export const TelegramAuthDataSchema = z.object({
  id: z.bigint().positive(),
  first_name: z.string().min(1).max(50),
  last_name: z.string().max(50).optional(),
  username: z.string()
    .min(3)
    .max(FIELD_CONSTRAINTS.USERNAME_MAX_LENGTH)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number().positive(),
  hash: z.string().length(64)
});

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export const schemas = {
  // User schemas
  User: UserSchema,
  UserProfile: UserSchema.partial().omit(['passwordHash', 'twoFactorSecret']),
  UserPreferences: UserPreferencesSchema,
  UserRole: UserRoleSchema,

  // Task schemas
  Task: TaskSchema,
  TaskData: TaskDataSchema,
  TaskStatus: TaskStatusSchema,
  TaskType: TaskTypeSchema,
  ConsensusLevel: ConsensusLevelSchema,

  // Project schemas
  Project: ProjectSchema,
  ProjectStatus: ProjectStatusSchema,

  // Payment schemas
  Transaction: TransactionSchema,
  PaymentRequest: PaymentRequestSchema,
  TransactionStatus: TransactionStatusSchema,
  TokenType: TokenTypeSchema,

  // API schemas
  Pagination: PaginationSchema,
  Sort: SortSchema,
  ApiResponse: ApiResponseSchema,

  // Telegram schemas
  TelegramAuthData: TelegramAuthDataSchema
};

export default schemas;