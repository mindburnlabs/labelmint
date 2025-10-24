// ============================================================================
// DATABASE SCHEMA TYPES
// ============================================================================

/**
 * Users table schema
 */
export interface UserSchema {
  id: number
  telegram_id: bigint | null
  username: string | null
  email: string | null
  first_name: string | null
  last_name: string | null
  language_code: string | null
  is_active: boolean
  role: string
  password_hash: string | null
  two_factor_secret: string | null
  two_factor_enabled: boolean
  wallet_balance: number
  total_earned: number
  total_withdrawn: number
  frozen_balance: number
  tasks_completed: number
  accuracy_rate: number | null
  trust_score: number
  suspicion_score: number
  level: number
  experience_points: number
  current_streak: number
  max_streak: number
  ton_wallet_address: string | null
  ton_wallet_version: string | null
  ton_wallet_testnet: boolean
  last_login_at: Date | null
  created_at: Date
  updated_at: Date
}

/**
 * Tasks table schema
 */
export interface TaskSchema {
  id: number
  project_id: number
  title: string
  description: string | null
  type: string
  sub_type: string | null
  data: any // JSON
  options: string[] | null // JSON
  status: string
  priority: number
  assigned_to: number | null
  assigned_at: Date | null
  completed_at: Date | null
  due_at: Date | null
  ai_prelabel: string | null
  ai_confidence: number | null
  consensus_target: number
  consensus_level: string
  final_label: string | null
  quality_score: number | null
  base_price: number
  points: number
  multiplier: number
  created_at: Date
  updated_at: Date
}

/**
 * Projects table schema
 */
export interface ProjectSchema {
  id: number
  name: string
  description: string | null
  owner_id: number
  status: string
  budget: number
  total_spent: number
  total_tasks: number
  completed_tasks: number
  payment_per_task: number
  requirements: any // JSON
  settings: any // JSON
  started_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

/**
 * Transactions table schema
 */
export interface TransactionSchema {
  id: number
  hash: string
  from_address: string
  to_address: string
  amount: string // Numeric string for precision
  token_type: string
  fee: string | null
  status: string
  message: string | null
  created_at: Date
  updated_at: Date
  block_number: number | null
  user_id: number | null
  project_id: number | null
}

/**
 * Task Responses table schema
 */
export interface TaskResponseSchema {
  id: number
  task_id: number
  user_id: number
  response: any // JSON
  confidence: number | null
  time_spent: number | null
  created_at: Date
  updated_at: Date
}

/**
 * Consensus table schema
 */
export interface ConsensusSchema {
  id: number
  task_id: number
  status: string
  final_label: string | null
  confidence_score: number | null
  participant_responses: any // JSON
  created_at: Date
  updated_at: Date
}

/**
 * Payment Channels table schema
 */
export interface PaymentChannelSchema {
  id: string
  participant1: string
  participant2: string
  capacity: number
  balance1: number
  balance2: number
  status: string
  created_at: Date
  last_update: Date
}

/**
 * Channel Transactions table schema
 */
export interface ChannelTransactionSchema {
  id: number
  hash: string
  from_address: string
  to_address: string
  amount: string
  token_type: string
  fee: string | null
  status: string
  message: string | null
  timestamp: Date
}

/**
 * Database field constraints
 */
export const FIELD_CONSTRAINTS = {
  // User constraints
  USERNAME_MAX_LENGTH: 32,
  EMAIL_MAX_LENGTH: 255,
  FIRST_NAME_MAX_LENGTH: 50,
  LAST_NAME_MAX_LENGTH: 50,
  LANGUAGE_CODE_MAX_LENGTH: 10,
  WALLET_ADDRESS_MAX_LENGTH: 66,

  // Task constraints
  TASK_TITLE_MAX_LENGTH: 255,
  TASK_DESCRIPTION_MAX_LENGTH: 1000,
  TASK_TYPE_MAX_LENGTH: 50,

  // Project constraints
  PROJECT_NAME_MAX_LENGTH: 255,
  PROJECT_DESCRIPTION_MAX_LENGTH: 2000,

  // Transaction constraints
  TX_HASH_MAX_LENGTH: 66,
  ADDRESS_MAX_LENGTH: 66,
  TOKEN_TYPE_MAX_LENGTH: 10,
  MESSAGE_MAX_LENGTH: 200,

  // General constraints
  MAX_INT_VALUE: 2147483647,
  MAX_DECIMAL_PRECISION: 20,
  MAX_DECIMAL_SCALE: 8
} as const;

/**
 * Database table names
 */
export const TABLE_NAMES = {
  USERS: 'users',
  TASKS: 'tasks',
  PROJECTS: 'projects',
  TRANSACTIONS: 'transactions',
  TASK_RESPONSES: 'task_responses',
  CONSENSUS: 'consensus',
  PAYMENT_CHANNELS: 'payment_channels',
  CHANNEL_TRANSACTIONS: 'channel_transactions',
  USER_TON_WALLETS: 'user_ton_wallets',
  ACHIEVEMENTS: 'achievements',
  USER_ACHIEVEMENTS: 'user_achievements',
  BLACKLISTED_ADDRESSES: 'blacklisted_addresses',
  SANCTIONED_ADDRESSES: 'sanctioned_addresses'
} as const;

/**
 * Database indexes
 */
export const DATABASE_INDEXES = {
  // User indexes
  USERS_TELEGRAM_ID: 'idx_users_telegram_id',
  USERS_EMAIL: 'idx_users_email',
  USERS_USERNAME: 'idx_users_username',
  USERS_ROLE: 'idx_users_role',

  // Task indexes
  TASKS_PROJECT_ID: 'idx_tasks_project_id',
  TASKS_ASSIGNED_TO: 'idx_tasks_assigned_to',
  TASKS_STATUS: 'idx_tasks_status',
  TASKS_TYPE: 'idx_tasks_type',
  TASKS_PRIORITY: 'idx_tasks_priority',

  // Transaction indexes
  TRANSACTIONS_HASH: 'idx_transactions_hash',
  TRANSACTIONS_FROM_ADDRESS: 'idx_transactions_from_address',
  TRANSACTIONS_TO_ADDRESS: 'idx_transactions_to_address',
  TRANSACTIONS_TOKEN_TYPE: 'idx_transactions_token_type',
  TRANSACTIONS_STATUS: 'idx_transactions_status',
  TRANSACTIONS_CREATED_AT: 'idx_transactions_created_at',

  // Composite indexes
  TASKS_STATUS_PRIORITY: 'idx_tasks_status_priority',
  TRANSACTIONS_WALLET_CREATED: 'idx_transactions_wallet_created'
} as const;

/**
 * Common query patterns
 */
export const QUERY_PATTERNS = {
  // Pagination
  PAGINATION: 'LIMIT $1 OFFSET $2',

  // Timestamp filtering
  CREATED_AFTER: 'created_at >= $1',
  CREATED_BEFORE: 'created_at <= $1',
  UPDATED_WITHIN: 'updated_at >= NOW() - INTERVAL',

  // Status filtering
  ACTIVE_STATUS: "status IN ('active', 'pending', 'in_progress')",
  INACTIVE_STATUS: "status IN ('inactive', 'completed', 'cancelled')",

  // User filtering
  BY_USER_ID: 'user_id = $1',
  BY_TELEGRAM_ID: 'telegram_id = $1',

  // Amount filtering
  AMOUNT_POSITIVE: 'amount > 0',
  AMOUNT_GREATER_THAN: 'amount > $1',
  AMOUNT_BETWEEN: 'amount BETWEEN $1 AND $2'
} as const;