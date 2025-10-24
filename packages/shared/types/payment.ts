// ============================================================================
// PAYMENT TYPES
// ============================================================================

export enum TransactionType {
  EARNING = 'EARNING',
  WITHDRAWAL = 'WITHDRAWAL',
  DEPOSIT = 'DEPOSIT',
  BONUS = 'BONUS',
  REFERRAL = 'REFERRAL',
  PENALTY = 'PENALTY',
  ADJUSTMENT = 'ADJUSTMENT',
  STAKING_REWARD = 'STAKING_REWARD'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum PayoutMethod {
  TON = 'TON',
  BITCOIN = 'BITCOIN',
  ETHEREUM = 'ETHEREUM',
  BANK_TRANSFER = 'BANK_TRANSFER',
  PAYPAL = 'PAYPAL',
  WISE = 'WISE'
}

export interface Wallet {
  id: string
  userId: string
  address: string
  testnet: boolean
  balance: number
  frozenBalance: number
  createdAt: Date
  updatedAt: Date
}

export interface Transaction {
  id: string
  userId: string
  amount: number
  currency: string
  type: TransactionType
  status: TransactionStatus
  referenceType?: string
  referenceId?: string
  walletAddress?: string
  transactionHash?: string
  fee: number
  description?: string
  metadata?: Record<string, any>
  createdAt: Date
  completedAt?: Date
}

export interface Withdrawal {
  id: string
  userId: string
  amount: number
  currency: string
  status: WithdrawalStatus
  walletAddress: string
  transactionHash?: string
  fee: number
  batchId?: string
  processedAt?: Date
  createdAt: Date
}

export interface ClientPayment {
  id: string
  projectId: string
  clientId: string
  amount: number
  currency: string
  status: PaymentStatus
  paymentMethod?: string
  description?: string
  metadata?: Record<string, any>
  createdAt: Date
  completedAt?: Date
}

export interface WorkerTransaction {
  id: string
  workerId: string
  amount: number
  type: string
  description?: string
  metadata?: Record<string, any>
  createdAt: Date
}

// ============================================================================
// TON BLOCKCHAIN PAYMENTS
// ============================================================================

export interface TonTransaction {
  id: string
  userId: string
  transactionHash: string
  fromAddress: string
  toAddress: string
  amount: number
  currency: string
  status: TonTxStatus
  blockHeight?: number
  lt?: bigint
  message?: string
  fee: number
  externalTxId?: string
  createdAt: Date
  confirmedAt?: Date
}

export enum TonTxStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED'
}

export interface UserTonWallet {
  userId: string
  address: string
  version: string
  testnet: boolean
  balance: number
  workchain: number
  lastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface TonNetworkConfig {
  id: string
  name: string
  testnet: boolean
  configServer: string
  apiEndpoint: string
  graphqlEndpoint: string
  lsEndpoint: string
  workchain: number
  masterchainId: number
  basechainId: number
  isActive: boolean
}

export interface PaymentRequest {
  id: string
  userId: string
  amount: number
  currency: string
  description?: string
  expiresAt: Date
  status: PaymentStatus
  paymentUrl?: string
  qrCode?: string
  createdAt: Date
  completedAt?: Date
}

// ============================================================================
// CRYPTO WALLETS
// ============================================================================

export interface UserCryptoWallet {
  id: string
  userId: string
  blockchain: string
  address: string
  label?: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CryptoTransaction {
  id: string
  userId: string
  blockchain: string
  network: string
  fromAddress: string
  toAddress: string
  amount: number
  tokenSymbol: string
  transactionHash: string
  blockNumber?: number
  gasUsed?: number
  gasPrice?: number
  fee?: number
  status: TransactionStatus
  metadata?: Record<string, any>
  createdAt: Date
  confirmedAt?: Date
}

// ============================================================================
// PAYOUT CONFIGURATION
// ============================================================================

export interface BankDetail {
  id: string
  userId: string
  bankName: string
  accountName: string
  accountNumber: string
  routingNumber?: string
  swiftCode?: string
  iban?: string
  isDefault: boolean
  createdAt: Date
}

export interface PayoutConfig {
  id: string
  userId: string
  method: PayoutMethod
  minAmount: number
  autoWithdraw: boolean
  schedule?: string // cron expression
  preferredCurrency?: string
  createdAt: Date
  updatedAt: Date
}

export interface WithdrawalBatch {
  id: string
  totalAmount: number
  currency: string
  count: number
  status: WithdrawalStatus
  processingFee: number
  createdAt: Date
  processedAt?: Date
  completedAt?: Date
  transactions: Withdrawal[]
}

// ============================================================================
// PAYMENT ANALYTICS
// ============================================================================

export interface PaymentStats {
  userId: string
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  date: Date
  earned: number
  withdrawn: number
  pending: number
  fees: number
  net: number
  tasks: number
  averagePerTask: number
  transactions: number
}

export interface PlatformPaymentMetrics {
  period: 'daily' | 'weekly' | 'monthly'
  date: Date
  totalVolume: number
  totalTransactions: number
  totalFees: number
  activeWorkers: number
  activeClients: number
  averageEarning: number
  withdrawalVolume: number
  depositVolume: number
  topEarners: {
    userId: string
    amount: number
    tasks: number
  }[]
  topClients: {
    userId: string
    amount: number
    projects: number
  }[]
}

// ============================================================================
// PRICING AND RATES
// ============================================================================

export interface TaskPricingRule {
  id: string
  taskType: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'
  basePrice: number
  timeEstimate: number // in seconds
  consensusTarget: number
  qualityBonus: number
  speedBonus: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PricingModel {
  id: string
  name: string
  description?: string
  rules: TaskPricingRule[]
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ExchangeRate {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: number
  source: string
  timestamp: Date
}

// ============================================================================
// PAYMENT NOTIFICATIONS
// ============================================================================

export interface PaymentNotification {
  id: string
  userId: string
  type: 'PAYMENT_RECEIVED' | 'WITHDRAWAL_PROCESSED' | 'PAYMENT_FAILED' | 'BALANCE_LOW'
  title: string
  message: string
  data: Record<string, any>
  read: boolean
  createdAt: Date
  readAt?: Date
}

export interface PaymentAlert {
  id: string
  userId: string
  type: 'LOW_BALANCE' | 'LARGE_WITHDRAWAL' | 'PAYMENT_FAILED' | 'SUSPICIOUS_ACTIVITY'
  threshold?: number
  enabled: boolean
  lastTriggered?: Date
  createdAt: Date
  updatedAt: Date
}