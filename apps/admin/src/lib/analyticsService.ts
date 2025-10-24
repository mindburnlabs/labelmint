import { ApiClient } from '@labelmint/shared/api-client';

export interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  activeProjects: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalTasks: number;
  completedTasks: number;
  avgQualityScore: number;
  disputeRate: number;
  avgTaskCompletionTime: number;
  totalEarnings: number;
  platformFee: number;
}

export interface UserMetrics {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  returningUsers: number;
  userGrowth: Array<{
    date: string;
    users: number;
    newUsers: number;
  }>;
  topCountries: Array<{
    country: string;
    users: number;
    percentage: number;
  }>;
  userRetention: {
    day1: number;
    day7: number;
    day30: number;
  };
  userEngagement: {
    avgSessionDuration: number;
    avgTasksPerUser: number;
    avgEarningsPerUser: number;
  };
}

export interface ProjectMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  projectTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  avgProjectDuration: number;
  projectSuccessRate: number;
  qualityMetrics: {
    avgQualityScore: number;
    disputeRate: number;
    revisionRate: number;
  };
}

export interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  failedTasks: number;
  avgCompletionTime: number;
  taskTypes: Array<{
    type: string;
    count: number;
    avgTime: number;
    successRate: number;
  }>;
  qualityDistribution: Array<{
    score: number;
    count: number;
    percentage: number;
  }>;
}

export interface FinancialMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  totalEarnings: number;
  platformFee: number;
  transactionVolume: number;
  avgTransactionValue: number;
  revenueBySource: Array<{
    source: string;
    amount: number;
    percentage: number;
  }>;
  paymentMethods: Array<{
    method: string;
    count: number;
    volume: number;
  }>;
}

export interface SystemMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
  };
  apiMetrics: {
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
  };
}

// Enterprise-specific metrics
export interface EnterpriseMetrics {
  totalOrganizations: number;
  activeOrganizations: number;
  organizationGrowth: Array<{
    date: string;
    organizations: number;
    newOrganizations: number;
  }>;
  planDistribution: Array<{
    plan: string;
    count: number;
    revenue: number;
    percentage: number;
  }>;
  churnRate: number;
  customerAcquisitionCost: number;
  lifetimeValue: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
}

export interface WorkflowMetrics {
  totalWorkflows: number;
  executedWorkflows: number;
  activeWorkflows: number;
  avgExecutionTime: number;
  successRate: number;
  errorRate: number;
  workflowTypes: Array<{
    type: string;
    count: number;
    avgTime: number;
    successRate: number;
  }>;
  executionTrends: Array<{
    date: string;
    executions: number;
    successes: number;
    failures: number;
  }>;
  performanceBottlenecks: Array<{
    workflowId: string;
    workflowName: string;
    avgTime: number;
    errorRate: number;
    frequency: number;
  }>;
}

export interface IntegrationMetrics {
  totalIntegrations: number;
  activeIntegrations: number;
  integrationTypes: Array<{
    type: string;
    count: number;
    usage: number;
    errors: number;
  }>;
  apiCallVolume: Array<{
    date: string;
    calls: number;
    errors: number;
  }>;
  topIntegrations: Array<{
    name: string;
    type: string;
    usage: number;
    successRate: number;
  }>;
  webhookStats: {
    totalWebhooks: number;
    successfulWebhooks: number;
    failedWebhooks: number;
    avgDeliveryTime: number;
  };
}

export interface ComplianceMetrics {
  overallScore: number;
  gdprCompliance: number;
  soc2Compliance: number;
  dataRetentionScore: number;
  securityScore: number;
  auditTrail: {
    totalEvents: number;
    criticalEvents: number;
    resolvedEvents: number;
    pendingEvents: number;
  };
  dataProcessing: {
    volumeProcessed: number;
    requestsPerMonth: number;
    avgProcessingTime: number;
    errorRate: number;
  };
  accessControl: {
    totalUsers: number;
    privilegedUsers: number;
    failedLogins: number;
    mfaUsage: number;
  };
}

export interface AnalyticsFilters {
  dateRange: {
    start: string;
    end: string;
  };
  projectId?: number;
  userId?: number;
  taskType?: string;
  status?: string;
}

export class AnalyticsService {
  private apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Get analytics overview
   */
  async getOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview> {
    try {
      const response = await this.apiClient.get('/analytics/overview', {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch analytics overview:', error);
      throw error;
    }
  }

  /**
   * Get user metrics
   */
  async getUserMetrics(filters: AnalyticsFilters): Promise<UserMetrics> {
    try {
      const response = await this.apiClient.get('/analytics/users', {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user metrics:', error);
      throw error;
    }
  }

  /**
   * Get project metrics
   */
  async getProjectMetrics(filters: AnalyticsFilters): Promise<ProjectMetrics> {
    try {
      const response = await this.apiClient.get('/analytics/projects', {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch project metrics:', error);
      throw error;
    }
  }

  /**
   * Get task metrics
   */
  async getTaskMetrics(filters: AnalyticsFilters): Promise<TaskMetrics> {
    try {
      const response = await this.apiClient.get('/analytics/tasks', {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch task metrics:', error);
      throw error;
    }
  }

  /**
   * Get financial metrics
   */
  async getFinancialMetrics(filters: AnalyticsFilters): Promise<FinancialMetrics> {
    try {
      const response = await this.apiClient.get('/analytics/financial', {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch financial metrics:', error);
      throw error;
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const response = await this.apiClient.get('/analytics/system');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
      throw error;
    }
  }

  /**
   * Get enterprise metrics
   */
  async getEnterpriseMetrics(filters: AnalyticsFilters): Promise<EnterpriseMetrics> {
    try {
      const response = await this.apiClient.get('/analytics/enterprise', {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch enterprise metrics:', error);
      throw error;
    }
  }

  /**
   * Get workflow metrics
   */
  async getWorkflowMetrics(filters: AnalyticsFilters): Promise<WorkflowMetrics> {
    try {
      const response = await this.apiClient.get('/analytics/workflows', {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch workflow metrics:', error);
      throw error;
    }
  }

  /**
   * Get integration metrics
   */
  async getIntegrationMetrics(filters: AnalyticsFilters): Promise<IntegrationMetrics> {
    try {
      const response = await this.apiClient.get('/analytics/integrations', {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch integration metrics:', error);
      throw error;
    }
  }

  /**
   * Get compliance metrics
   */
  async getComplianceMetrics(filters: AnalyticsFilters): Promise<ComplianceMetrics> {
    try {
      const response = await this.apiClient.get('/analytics/compliance', {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch compliance metrics:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealtimeMetrics(): Promise<{
    activeUsers: number;
    currentTasks: number;
    systemLoad: number;
    recentActivity: Array<{
      type: string;
      description: string;
      timestamp: string;
    }>;
  }> {
    try {
      const response = await this.apiClient.get('/analytics/realtime');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch real-time metrics:', error);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportData(
    type: 'overview' | 'users' | 'projects' | 'tasks' | 'financial',
    filters: AnalyticsFilters,
    format: 'csv' | 'json' | 'xlsx' = 'csv'
  ): Promise<Blob> {
    try {
      const response = await this.apiClient.get(`/analytics/export/${type}`, {
        params: { ...filters, format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Failed to export analytics data:', error);
      throw error;
    }
  }

  /**
   * Get analytics dashboard data
   */
  async getDashboardData(filters: AnalyticsFilters): Promise<{
    overview: AnalyticsOverview;
    userMetrics: UserMetrics;
    projectMetrics: ProjectMetrics;
    taskMetrics: TaskMetrics;
    financialMetrics: FinancialMetrics;
    systemMetrics: SystemMetrics;
    realtime: any;
  }> {
    try {
      const [
        overview,
        userMetrics,
        projectMetrics,
        taskMetrics,
        financialMetrics,
        systemMetrics,
        realtime
      ] = await Promise.all([
        this.getOverview(filters),
        this.getUserMetrics(filters),
        this.getProjectMetrics(filters),
        this.getTaskMetrics(filters),
        this.getFinancialMetrics(filters),
        this.getSystemMetrics(),
        this.getRealtimeMetrics()
      ]);

      return {
        overview,
        userMetrics,
        projectMetrics,
        taskMetrics,
        financialMetrics,
        systemMetrics,
        realtime
      };
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      throw error;
    }
  }
}

// Create singleton instance
let analyticsService: AnalyticsService | null = null;

export function initializeAnalyticsService(apiClient: ApiClient): AnalyticsService {
  analyticsService = new AnalyticsService(apiClient);
  return analyticsService;
}

export function getAnalyticsService(): AnalyticsService {
  if (!analyticsService) {
    throw new Error('AnalyticsService not initialized. Call initializeAnalyticsService first.');
  }
  return analyticsService;
}
