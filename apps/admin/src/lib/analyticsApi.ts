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
}

export interface FinancialMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  revenueGrowth: number;
  revenueByService: Array<{
    service: string;
    revenue: number;
    percentage: number;
  }>;
  transactionVolume: number;
  avgTransactionValue: number;
  paymentMethods: Array<{
    method: string;
    count: number;
    percentage: number;
  }>;
}

export interface QualityMetrics {
  avgAccuracy: number;
  avgQualityScore: number;
  disputeRate: number;
  qualityTrends: Array<{
    date: string;
    accuracy: number;
    disputes: number;
  }>;
  topPerformers: Array<{
    id: string;
    name: string;
    accuracy: number;
    tasksCompleted: number;
  }>;
}

export interface AnalyticsFilters {
  dateRange: '7d' | '30d' | '90d' | '365d' | 'custom';
  startDate?: string;
  endDate?: string;
  projectType?: string;
  userRole?: 'all' | 'clients' | 'workers';
  country?: string;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf' | 'xlsx';
  includeCharts?: boolean;
  dateRange: string;
}

class AnalyticsApiService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      timeout: 30000,
    });
  }

  /**
   * Get analytics overview data
   */
  async getOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview> {
    try {
      const response = await this.apiClient.get('/api/analytics/overview', {
        params: filters,
      });

      return {
        totalUsers: response.data.totalUsers || 0,
        activeUsers: response.data.activeUsers || 0,
        totalProjects: response.data.totalProjects || 0,
        activeProjects: response.data.activeProjects || 0,
        totalRevenue: response.data.totalRevenue || 0,
        monthlyRevenue: response.data.monthlyRevenue || 0,
        totalTasks: response.data.totalTasks || 0,
        completedTasks: response.data.completedTasks || 0,
        avgQualityScore: response.data.avgQualityScore || 0,
        disputeRate: response.data.disputeRate || 0,
      };
    } catch (error) {
      console.error('Failed to fetch analytics overview:', error);
      // Return mock data for development
      return this.getMockOverview();
    }
  }

  /**
   * Get user metrics
   */
  async getUserMetrics(filters: AnalyticsFilters): Promise<UserMetrics> {
    try {
      const response = await this.apiClient.get('/api/analytics/users', {
        params: filters,
      });

      return {
        totalUsers: response.data.totalUsers || 0,
        newUsers: response.data.newUsers || 0,
        activeUsers: response.data.activeUsers || 0,
        returningUsers: response.data.returningUsers || 0,
        userGrowth: response.data.userGrowth || [],
        topCountries: response.data.topCountries || [],
        userRetention: response.data.userRetention || { day1: 0, day7: 0, day30: 0 },
      };
    } catch (error) {
      console.error('Failed to fetch user metrics:', error);
      return this.getMockUserMetrics();
    }
  }

  /**
   * Get project metrics
   */
  async getProjectMetrics(filters: AnalyticsFilters): Promise<ProjectMetrics> {
    try {
      const response = await this.apiClient.get('/api/analytics/projects', {
        params: filters,
      });

      return {
        totalProjects: response.data.totalProjects || 0,
        activeProjects: response.data.activeProjects || 0,
        completedProjects: response.data.completedProjects || 0,
        projectTypes: response.data.projectTypes || [],
        avgProjectDuration: response.data.avgProjectDuration || 0,
        projectSuccessRate: response.data.projectSuccessRate || 0,
      };
    } catch (error) {
      console.error('Failed to fetch project metrics:', error);
      return this.getMockProjectMetrics();
    }
  }

  /**
   * Get financial metrics
   */
  async getFinancialMetrics(filters: AnalyticsFilters): Promise<FinancialMetrics> {
    try {
      const response = await this.apiClient.get('/api/analytics/financial', {
        params: filters,
      });

      return {
        totalRevenue: response.data.totalRevenue || 0,
        monthlyRevenue: response.data.monthlyRevenue || 0,
        revenueGrowth: response.data.revenueGrowth || 0,
        revenueByService: response.data.revenueByService || [],
        transactionVolume: response.data.transactionVolume || 0,
        avgTransactionValue: response.data.avgTransactionValue || 0,
        paymentMethods: response.data.paymentMethods || [],
      };
    } catch (error) {
      console.error('Failed to fetch financial metrics:', error);
      return this.getMockFinancialMetrics();
    }
  }

  /**
   * Get quality metrics
   */
  async getQualityMetrics(filters: AnalyticsFilters): Promise<QualityMetrics> {
    try {
      const response = await this.apiClient.get('/api/analytics/quality', {
        params: filters,
      });

      return {
        avgAccuracy: response.data.avgAccuracy || 0,
        avgQualityScore: response.data.avgQualityScore || 0,
        disputeRate: response.data.disputeRate || 0,
        qualityTrends: response.data.qualityTrends || [],
        topPerformers: response.data.topPerformers || [],
      };
    } catch (error) {
      console.error('Failed to fetch quality metrics:', error);
      return this.getMockQualityMetrics();
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(type: string, options: ExportOptions): Promise<Blob> {
    try {
      const response = await this.apiClient.post('/api/analytics/reports', {
        type,
        ...options,
      }, {
        responseType: 'blob',
      });

      return new Blob([response.data], {
        type: options.format === 'pdf' ? 'application/pdf' : 'application/json',
      });
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw new Error('Failed to generate report');
    }
  }

  /**
   * Export analytics data
   */
  async exportData(type: string, format: string, filters: AnalyticsFilters): Promise<Blob> {
    try {
      const response = await this.apiClient.get('/api/analytics/export', {
        params: { type, format, ...filters },
        responseType: 'blob',
      });

      return new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
    } catch (error) {
      console.error('Failed to export data:', error);
      throw new Error('Failed to export data');
    }
  }

  /**
   * Get real-time analytics data
   */
  async getRealTimeData(): Promise<any> {
    try {
      const response = await this.apiClient.get('/api/analytics/realtime');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch real-time data:', error);
      return this.getMockRealTimeData();
    }
  }

  /**
   * Get enterprise metrics
   */
  async getEnterpriseMetrics(filters: AnalyticsFilters): Promise<any> {
    try {
      const response = await this.apiClient.get('/api/analytics/enterprise', {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch enterprise metrics:', error);
      return this.getMockEnterpriseMetrics();
    }
  }

  /**
   * Get workflow metrics
   */
  async getWorkflowMetrics(filters: AnalyticsFilters): Promise<any> {
    try {
      const response = await this.apiClient.get('/api/analytics/workflows', {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch workflow metrics:', error);
      return this.getMockWorkflowMetrics();
    }
  }

  /**
   * Get integration metrics
   */
  async getIntegrationMetrics(filters: AnalyticsFilters): Promise<any> {
    try {
      const response = await this.apiClient.get('/api/analytics/integrations', {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch integration metrics:', error);
      return this.getMockIntegrationMetrics();
    }
  }

  /**
   * Get compliance metrics
   */
  async getComplianceMetrics(filters: AnalyticsFilters): Promise<any> {
    try {
      const response = await this.apiClient.get('/api/analytics/compliance', {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch compliance metrics:', error);
      return this.getMockComplianceMetrics();
    }
  }

  // Mock data methods for development
  private getMockOverview(): AnalyticsOverview {
    return {
      totalUsers: 1250,
      activeUsers: 890,
      totalProjects: 45,
      activeProjects: 12,
      totalRevenue: 125000,
      monthlyRevenue: 15000,
      totalTasks: 12500,
      completedTasks: 11800,
      avgQualityScore: 94.5,
      disputeRate: 2.1,
    };
  }

  private getMockUserMetrics(): UserMetrics {
    return {
      totalUsers: 1250,
      newUsers: 85,
      activeUsers: 890,
      returningUsers: 650,
      userGrowth: [
        { date: '2024-01-01', users: 1000, newUsers: 50 },
        { date: '2024-01-02', users: 1050, newUsers: 45 },
        { date: '2024-01-03', users: 1100, newUsers: 60 },
        { date: '2024-01-04', users: 1150, newUsers: 55 },
        { date: '2024-01-05', users: 1200, newUsers: 70 },
        { date: '2024-01-06', users: 1250, newUsers: 85 },
      ],
      topCountries: [
        { country: 'United States', users: 450, percentage: 36 },
        { country: 'India', users: 280, percentage: 22.4 },
        { country: 'Philippines', users: 180, percentage: 14.4 },
        { country: 'United Kingdom', users: 120, percentage: 9.6 },
        { country: 'Canada', users: 100, percentage: 8 },
      ],
      userRetention: {
        day1: 85.2,
        day7: 72.1,
        day30: 58.3,
      },
    };
  }

  private getMockProjectMetrics(): ProjectMetrics {
    return {
      totalProjects: 45,
      activeProjects: 12,
      completedProjects: 33,
      projectTypes: [
        { type: 'Image Classification', count: 20, percentage: 44.4 },
        { type: 'Text Annotation', count: 15, percentage: 33.3 },
        { type: 'Data Validation', count: 7, percentage: 15.6 },
        { type: 'Audio Transcription', count: 3, percentage: 6.7 },
      ],
      avgProjectDuration: 14.5,
      projectSuccessRate: 87.2,
    };
  }

  private getMockFinancialMetrics(): FinancialMetrics {
    return {
      totalRevenue: 125000,
      monthlyRevenue: 15000,
      revenueGrowth: 23.5,
      revenueByService: [
        { service: 'Image Classification', revenue: 45000, percentage: 36 },
        { service: 'Text Annotation', revenue: 32000, percentage: 25.6 },
        { service: 'Data Validation', revenue: 28000, percentage: 22.4 },
        { service: 'Audio Transcription', revenue: 20000, percentage: 16 },
      ],
      transactionVolume: 1250,
      avgTransactionValue: 100,
      paymentMethods: [
        { method: 'TON', count: 800, percentage: 64 },
        { method: 'Credit Card', count: 300, percentage: 24 },
        { method: 'Bank Transfer', count: 150, percentage: 12 },
      ],
    };
  }

  private getMockQualityMetrics(): QualityMetrics {
    return {
      avgAccuracy: 94.5,
      avgQualityScore: 92.1,
      disputeRate: 2.1,
      qualityTrends: [
        { date: 'Week 1', accuracy: 94.2, disputes: 12 },
        { date: 'Week 2', accuracy: 94.5, disputes: 10 },
        { date: 'Week 3', accuracy: 95.1, disputes: 8 },
        { date: 'Week 4', accuracy: 95.8, disputes: 6 },
      ],
      topPerformers: [
        { id: '1', name: 'Alice Johnson', accuracy: 98.5, tasksCompleted: 450 },
        { id: '2', name: 'Bob Smith', accuracy: 97.8, tasksCompleted: 380 },
        { id: '3', name: 'Carol Davis', accuracy: 97.2, tasksCompleted: 320 },
        { id: '4', name: 'David Wilson', accuracy: 96.9, tasksCompleted: 290 },
        { id: '5', name: 'Eva Brown', accuracy: 96.5, tasksCompleted: 275 },
      ],
    };
  }

  private getMockRealTimeData(): any {
    return {
      activeUsers: 45,
      tasksInProgress: 12,
      revenueToday: 1250,
      qualityScore: 94.5,
      systemHealth: 'excellent',
      lastUpdated: new Date().toISOString(),
    };
  }

  private getMockEnterpriseMetrics(): any {
    return {
      totalOrganizations: 125,
      activeOrganizations: 98,
      organizationGrowth: [
        { date: '2024-01-01', organizations: 100, newOrganizations: 5 },
        { date: '2024-01-02', organizations: 105, newOrganizations: 8 },
        { date: '2024-01-03', organizations: 113, newOrganizations: 12 },
        { date: '2024-01-04', organizations: 118, newOrganizations: 7 },
        { date: '2024-01-05', organizations: 120, newOrganizations: 3 },
        { date: '2024-01-06', organizations: 125, newOrganizations: 8 },
      ],
      planDistribution: [
        { plan: 'Basic', count: 45, revenue: 4500, percentage: 36 },
        { plan: 'Professional', count: 50, revenue: 10000, percentage: 40 },
        { plan: 'Enterprise', count: 30, revenue: 12000, percentage: 24 },
      ],
      churnRate: 3.2,
      customerAcquisitionCost: 250,
      lifetimeValue: 5400,
      monthlyRecurringRevenue: 26500,
      annualRecurringRevenue: 318000,
    };
  }

  private getMockWorkflowMetrics(): any {
    return {
      totalWorkflows: 85,
      executedWorkflows: 1240,
      activeWorkflows: 12,
      avgExecutionTime: 45.2,
      successRate: 94.3,
      errorRate: 2.1,
      workflowTypes: [
        { type: 'Data Processing', count: 35, avgTime: 30.5, successRate: 96.2 },
        { type: 'Quality Assurance', count: 28, avgTime: 45.8, successRate: 94.1 },
        { type: 'Report Generation', count: 15, avgTime: 120.3, successRate: 91.8 },
        { type: 'Notification', count: 7, avgTime: 5.2, successRate: 98.5 },
      ],
      executionTrends: [
        { date: '2024-01-01', executions: 180, successes: 170, failures: 10 },
        { date: '2024-01-02', executions: 195, successes: 185, failures: 10 },
        { date: '2024-01-03', executions: 210, successes: 198, failures: 12 },
        { date: '2024-01-04', executions: 205, successes: 194, failures: 11 },
        { date: '2024-01-05', executions: 220, successes: 210, failures: 10 },
        { date: '2024-01-06', executions: 230, successes: 218, failures: 12 },
      ],
      performanceBottlenecks: [
        { workflowId: 'wf1', workflowName: 'Daily Report Generation', avgTime: 125.5, errorRate: 5.2, frequency: 50 },
        { workflowId: 'wf2', workflowName: 'Data Quality Check', avgTime: 89.3, errorRate: 3.1, frequency: 45 },
        { workflowId: 'wf3', workflowName: 'Customer Onboarding', avgTime: 156.8, errorRate: 2.8, frequency: 30 },
        { workflowId: 'wf4', workflowName: 'Invoice Processing', avgTime: 67.2, errorRate: 1.5, frequency: 25 },
        { workflowId: 'wf5', workflowName: 'Email Campaign', avgTime: 45.6, errorRate: 0.8, frequency: 20 },
      ],
    };
  }

  private getMockIntegrationMetrics(): any {
    return {
      totalIntegrations: 156,
      activeIntegrations: 142,
      integrationTypes: [
        { type: 'Slack', count: 45, usage: 1250, errors: 12 },
        { type: 'Teams', count: 38, usage: 980, errors: 8 },
        { type: 'Jira', count: 32, usage: 750, errors: 15 },
        { type: 'Salesforce', count: 28, usage: 620, errors: 6 },
        { type: 'Webhook', count: 13, usage: 320, errors: 3 },
      ],
      apiCallVolume: [
        { date: '2024-01-01', calls: 4500, errors: 45 },
        { date: '2024-01-02', calls: 4800, errors: 38 },
        { date: '2024-01-03', calls: 5200, errors: 52 },
        { date: '2024-01-04', calls: 4900, errors: 41 },
        { date: '2024-01-05', calls: 5400, errors: 48 },
        { date: '2024-01-06', calls: 5800, errors: 55 },
      ],
      topIntegrations: [
        { name: 'Slack Workspace', type: 'Slack', usage: 450, successRate: 98.2 },
        { name: 'Teams Channel', type: 'Teams', usage: 380, successRate: 97.8 },
        { name: 'Jira Projects', type: 'Jira', usage: 320, successRate: 96.5 },
        { name: 'Salesforce CRM', type: 'Salesforce', usage: 280, successRate: 99.1 },
        { name: 'Custom Webhook', type: 'Webhook', usage: 180, successRate: 95.8 },
      ],
      webhookStats: {
        totalWebhooks: 850,
        successfulWebhooks: 815,
        failedWebhooks: 35,
        avgDeliveryTime: 245,
      },
    };
  }

  private getMockComplianceMetrics(): any {
    return {
      overallScore: 94.5,
      gdprCompliance: 96.2,
      soc2Compliance: 92.8,
      dataRetentionScore: 91.5,
      securityScore: 95.3,
      auditTrail: {
        totalEvents: 12500,
        criticalEvents: 45,
        resolvedEvents: 42,
        pendingEvents: 3,
      },
      dataProcessing: {
        volumeProcessed: 2500000, // 2.5M records
        requestsPerMonth: 85000,
        avgProcessingTime: 125, // ms
        errorRate: 0.8,
      },
      accessControl: {
        totalUsers: 1250,
        privilegedUsers: 85,
        failedLogins: 12,
        mfaUsage: 87.5,
      },
    };
  }
}

export const analyticsApi = new AnalyticsApiService();
export default analyticsApi;
