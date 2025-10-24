import React, { useState, useEffect } from 'react';
import { Card } from '@labelmint/ui/components/Card';
import { Button } from '@labelmint/ui/components/Button';
import { Select } from '@labelmint/ui/components/Select';
import { DatePicker } from '@labelmint/ui/components/DatePicker';
import { Badge } from '@labelmint/ui/components/Badge';
import { 
  AnalyticsService, 
  AnalyticsOverview, 
  UserMetrics, 
  ProjectMetrics, 
  TaskMetrics, 
  FinancialMetrics, 
  SystemMetrics,
  AnalyticsFilters 
} from '../../lib/analyticsService';

export interface AnalyticsDashboardProps {
  className?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  className = ''
}) => {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    }
  });

  const [data, setData] = useState<{
    overview: AnalyticsOverview | null;
    userMetrics: UserMetrics | null;
    projectMetrics: ProjectMetrics | null;
    taskMetrics: TaskMetrics | null;
    financialMetrics: FinancialMetrics | null;
    systemMetrics: SystemMetrics | null;
    realtime: any;
  }>({
    overview: null,
    userMetrics: null,
    projectMetrics: null,
    taskMetrics: null,
    financialMetrics: null,
    systemMetrics: null,
    realtime: null
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const analyticsService = new AnalyticsService({} as any); // Replace with actual API client
      const dashboardData = await analyticsService.getDashboardData(filters);
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleDateRangeChange = (start: string, end: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: { start, end }
    }));
  };

  const handleProjectFilter = (projectId: string) => {
    setFilters(prev => ({
      ...prev,
      projectId: projectId ? parseInt(projectId) : undefined
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = (num: number) => {
    return `${(num * 100).toFixed(1)}%`;
  };

  if (error) {
    return (
      <div className={`analytics-dashboard ${className}`}>
        <Card className="p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Analytics</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadData}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`analytics-dashboard ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <div className="flex gap-4">
          <DatePicker
            value={filters.dateRange.start}
            onChange={(date) => handleDateRangeChange(date, filters.dateRange.end)}
            placeholder="Start Date"
          />
          <DatePicker
            value={filters.dateRange.end}
            onChange={(date) => handleDateRangeChange(filters.dateRange.start, date)}
            placeholder="End Date"
          />
          <Select
            value={filters.projectId?.toString() || ''}
            onValueChange={handleProjectFilter}
          >
            <option value="">All Projects</option>
            {/* Project options would be populated here */}
          </Select>
          <Button onClick={loadData} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {data.overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{formatNumber(data.overview.totalUsers)}</p>
              </div>
              <div className="text-2xl">👥</div>
            </div>
            <div className="mt-2">
              <Badge variant="secondary">
                {formatNumber(data.overview.activeUsers)} active
              </Badge>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(data.overview.totalRevenue)}</p>
              </div>
              <div className="text-2xl">💰</div>
            </div>
            <div className="mt-2">
              <Badge variant="secondary">
                {formatCurrency(data.overview.monthlyRevenue)} this month
              </Badge>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{formatNumber(data.overview.totalTasks)}</p>
              </div>
              <div className="text-2xl">📋</div>
            </div>
            <div className="mt-2">
              <Badge variant="secondary">
                {formatNumber(data.overview.completedTasks)} completed
              </Badge>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Quality Score</p>
                <p className="text-2xl font-bold">{data.overview.avgQualityScore.toFixed(1)}</p>
              </div>
              <div className="text-2xl">⭐</div>
            </div>
            <div className="mt-2">
              <Badge variant="secondary">
                {formatPercentage(1 - data.overview.disputeRate)} success rate
              </Badge>
            </div>
          </Card>
        </div>
      )}

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Metrics */}
        {data.userMetrics && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">User Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>New Users</span>
                <span className="font-medium">{formatNumber(data.userMetrics.newUsers)}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Users</span>
                <span className="font-medium">{formatNumber(data.userMetrics.activeUsers)}</span>
              </div>
              <div className="flex justify-between">
                <span>Returning Users</span>
                <span className="font-medium">{formatNumber(data.userMetrics.returningUsers)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Session Duration</span>
                <span className="font-medium">
                  {Math.floor(data.userMetrics.userEngagement.avgSessionDuration / 60)}m
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Project Metrics */}
        {data.projectMetrics && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Project Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Active Projects</span>
                <span className="font-medium">{formatNumber(data.projectMetrics.activeProjects)}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed Projects</span>
                <span className="font-medium">{formatNumber(data.projectMetrics.completedProjects)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Duration</span>
                <span className="font-medium">
                  {Math.floor(data.projectMetrics.avgProjectDuration / 24)} days
                </span>
              </div>
              <div className="flex justify-between">
                <span>Success Rate</span>
                <span className="font-medium">{formatPercentage(data.projectMetrics.projectSuccessRate)}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Task Metrics */}
        {data.taskMetrics && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Task Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Pending Tasks</span>
                <span className="font-medium">{formatNumber(data.taskMetrics.pendingTasks)}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed Tasks</span>
                <span className="font-medium">{formatNumber(data.taskMetrics.completedTasks)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Completion Time</span>
                <span className="font-medium">
                  {Math.floor(data.taskMetrics.avgCompletionTime / 60)}m
                </span>
              </div>
              <div className="flex justify-between">
                <span>Failed Tasks</span>
                <span className="font-medium">{formatNumber(data.taskMetrics.failedTasks)}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Financial Metrics */}
        {data.financialMetrics && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Financial Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Monthly Revenue</span>
                <span className="font-medium">{formatCurrency(data.financialMetrics.monthlyRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Earnings</span>
                <span className="font-medium">{formatCurrency(data.financialMetrics.totalEarnings)}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform Fee</span>
                <span className="font-medium">{formatCurrency(data.financialMetrics.platformFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Transaction</span>
                <span className="font-medium">{formatCurrency(data.financialMetrics.avgTransactionValue)}</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* System Metrics */}
      {data.systemMetrics && (
        <Card className="p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">System Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium mb-2">Performance</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Uptime</span>
                  <span>{formatPercentage(data.systemMetrics.uptime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Response Time</span>
                  <span>{data.systemMetrics.responseTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span>{formatPercentage(data.systemMetrics.errorRate)}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">API Metrics</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Requests</span>
                  <span>{formatNumber(data.systemMetrics.apiMetrics.totalRequests)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate</span>
                  <span>{formatPercentage(data.systemMetrics.apiMetrics.successRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Response</span>
                  <span>{data.systemMetrics.apiMetrics.avgResponseTime}ms</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Resource Usage</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>CPU</span>
                  <span>{formatPercentage(data.systemMetrics.resourceUsage.cpu)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Memory</span>
                  <span>{formatPercentage(data.systemMetrics.resourceUsage.memory)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage</span>
                  <span>{formatPercentage(data.systemMetrics.resourceUsage.storage)}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};