// Dashboard Types
export interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  activeProjects: number;
  totalRevenue: number;
  monthlyRevenue: number;
  avgCompletionRate: number;
  avgQualityScore: number;
  systemHealth: SystemHealth;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  apiLatency: number;
  databaseConnections: number;
  errorRate: number;
  uptime: number;
}

// User Types
export interface User {
  id: string;
  email: string;
  role: 'client' | 'worker' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    timezone?: string;
  };
  stats: UserStats;
  joinedAt: string;
  lastActiveAt: string;
}

export interface UserStats {
  totalSpent?: number;
  totalEarned?: number;
  projectsCompleted?: number;
  tasksCompleted?: number;
  accuracy?: number;
  rating?: number;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  description: string;
  clientId: string;
  clientName: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  type: 'image_classification' | 'text_annotation' | 'data_validation' | 'audio_transcription';
  settings: ProjectSettings;
  stats: ProjectStats;
  budget: ProjectBudget;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
}

export interface ProjectSettings {
  instructions: string;
  guidelines: string[];
  requiredAccuracy: number;
  consensusLevel: number;
  paymentPerTask: number;
  maxWorkersPerTask: number;
  honeypotEnabled: boolean;
  reviewEnabled: boolean;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  disputedTasks: number;
  accuracyRate: number;
  avgTimePerTask: number;
  topWorkers: Array<{
    id: string;
    name: string;
    tasksCompleted: number;
    accuracy: number;
  }>;
}

export interface ProjectBudget {
  total: number;
  spent: number;
  remaining: number;
  currency: string;
}

// Financial Types
export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'task_payment' | 'refund' | 'fee';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  fromUserId?: string;
  toUserId?: string;
  fromWallet?: string;
  toWallet?: string;
  metadata: Record<string, any>;
  createdAt: string;
  completedAt?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  method: 'ton' | 'usdt';
  wallet: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed';
  processedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  dailyRevenue: number;
  revenueByService: Record<string, number>;
  revenueByClient: Array<{
    clientId: string;
    clientName: string;
    revenue: number;
    projects: number;
  }>;
  growth: {
    monthly: number;
    weekly: number;
    daily: number;
  };
}

// Dispute Types
export interface Dispute {
  id: string;
  taskId: string;
  projectId: string;
  workerId: string;
  workerName: string;
  clientId: string;
  clientName: string;
  type: 'quality' | 'guidelines' | 'payment' | 'technical';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  evidence: DisputeEvidence[];
  resolution?: DisputeResolution;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeEvidence {
  id: string;
  type: 'screenshot' | 'text' | 'file' | 'recording';
  content: string;
  submittedBy: string;
  submittedAt: string;
}

export interface DisputeResolution {
  outcome: 'worker_favor' | 'client_favor' | 'compromise';
  reasoning: string;
  action: 'revert_task' | 'repay' | 'partial_refund' | 'credit' | 'no_action';
  amount?: number;
  resolvedBy: string;
  resolvedAt: string;
}

// Analytics Types
export interface Analytics {
  overview: DashboardMetrics;
  userMetrics: UserMetrics;
  projectMetrics: ProjectMetrics;
  financialMetrics: FinancialMetrics;
  qualityMetrics: QualityMetrics;
}

export interface UserMetrics {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  userRetention: number;
  usersByRole: Record<string, number>;
  usersByStatus: Record<string, number>;
  topCountries: Array<{
    country: string;
    users: number;
    percentage: number;
  }>;
}

export interface ProjectMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  avgProjectDuration: number;
  projectsByType: Record<string, number>;
  projectsByStatus: Record<string, number>;
  topClients: Array<{
    clientId: string;
    clientName: string;
    projects: number;
    budget: number;
  }>;
}

export interface FinancialMetrics {
  totalRevenue: number;
  totalPayments: number;
  avgPaymentPerTask: number;
  paymentVolume: Array<{
    date: string;
    volume: number;
    transactions: number;
  }>;
  revenueDistribution: Record<string, number>;
}

export interface QualityMetrics {
  avgAccuracy: number;
  consensusRate: number;
  disputeRate: number;
  reworkRate: number;
  qualityTrends: Array<{
    date: string;
    accuracy: number;
    disputes: number;
  }>;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Filter Types
export interface DateRange {
  start: string;
  end: string;
}

export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
  dateRange?: DateRange;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProjectFilters {
  status?: string;
  type?: string;
  clientId?: string;
  dateRange?: DateRange;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Admin Activity Log
export interface ActivityLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}