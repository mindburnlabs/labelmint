'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { analyticsApi } from '@/lib/analyticsApi';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { KPICard } from '@/components/charts/KPICard';
import { Button } from '@labelmint/ui/components/Button';
import { formatCurrency } from '@labelmint/utils';
import { EnterpriseAnalytics } from '@/components/analytics/EnterpriseAnalytics';
import {
  UsersIcon,
  FolderIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d');

  const filters = { dateRange: dateRange as any };

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview', dateRange],
    queryFn: () => analyticsApi.getOverview(filters),
  });

  const { data: userMetrics, isLoading: userLoading } = useQuery({
    queryKey: ['analytics-users', dateRange],
    queryFn: () => analyticsApi.getUserMetrics(filters),
  });

  const { data: projectMetrics, isLoading: projectLoading } = useQuery({
    queryKey: ['analytics-projects', dateRange],
    queryFn: () => analyticsApi.getProjectMetrics(filters),
  });

  const { data: financialMetrics, isLoading: financialLoading } = useQuery({
    queryKey: ['analytics-financial', dateRange],
    queryFn: () => analyticsApi.getFinancialMetrics(filters),
  });

  const { data: qualityMetrics, isLoading: qualityLoading } = useQuery({
    queryKey: ['analytics-quality', dateRange],
    queryFn: () => analyticsApi.getQualityMetrics(filters),
  });

  // Enterprise metrics
  const { data: enterpriseMetrics, isLoading: enterpriseLoading } = useQuery({
    queryKey: ['analytics-enterprise', dateRange],
    queryFn: () => analyticsApi.getEnterpriseMetrics(filters),
  });

  const { data: workflowMetrics, isLoading: workflowLoading } = useQuery({
    queryKey: ['analytics-workflows', dateRange],
    queryFn: () => analyticsApi.getWorkflowMetrics(filters),
  });

  const { data: integrationMetrics, isLoading: integrationLoading } = useQuery({
    queryKey: ['analytics-integrations', dateRange],
    queryFn: () => analyticsApi.getIntegrationMetrics(filters),
  });

  const { data: complianceMetrics, isLoading: complianceLoading } = useQuery({
    queryKey: ['analytics-compliance', dateRange],
    queryFn: () => analyticsApi.getComplianceMetrics(filters),
  });

  // Use real data from API calls
  const userGrowthData = userMetrics?.userGrowth || [];
  const projectTypeDistribution = projectMetrics?.projectTypes?.map(p => ({
    name: p.type,
    value: p.percentage
  })) || [];
  const topCountries = userMetrics?.topCountries || [];
  const qualityTrends = qualityMetrics?.qualityTrends || [];
  const revenueByService = financialMetrics?.revenueByService || [];

  const handleGenerateReport = async (type: string) => {
    try {
      const response = await analyticsApi.generateReport(type, {
        dateRange,
        format: 'pdf',
      });
      console.log('Report generated:', response);
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  const handleExportData = async (type: string, format: string) => {
    try {
      const response = await analyticsApi.exportData(type, format, {
        dateRange,
      });
      console.log('Data exported:', response);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Analytics & Reports
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Business intelligence and performance insights.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Schedule Reports
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              Create Custom Report
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Date Range</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Select timeframe for analytics</p>
              </div>
            </div>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 3 months</option>
              <option value="365d">Last year</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExportData('analytics', 'csv')}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleGenerateReport('full-report')}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-2"
            >
              <DocumentTextIcon className="h-4 w-4" />
              <span>Generate Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          title="Total Users"
          value={userMetrics?.totalUsers?.toLocaleString() || '0'}
          change={15.3}
          changeType="increase"
          icon={<UsersIcon className="h-6 w-6" />}
          loading={userLoading}
        />
        <KPICard
          title="Active Projects"
          value={projectMetrics?.activeProjects?.toLocaleString() || '0'}
          change={8.7}
          changeType="increase"
          icon={<FolderIcon className="h-6 w-6" />}
          loading={projectLoading}
        />
        <KPICard
          title="Total Revenue"
          value={formatCurrency(financialMetrics?.totalRevenue || 0)}
          change={23.5}
          changeType="increase"
          icon={<CurrencyDollarIcon className="h-6 w-6" />}
          loading={financialLoading}
        />
        <KPICard
          title="Avg Quality Score"
          value={`${(qualityMetrics?.avgAccuracy || 0).toFixed(1)}%`}
          change={2.1}
          changeType="increase"
          icon={<CheckCircleIcon className="h-6 w-6" />}
          loading={qualityLoading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* User Growth Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              User Growth Trend
            </h2>
            <select className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              All Users
            </select>
          </div>
          <LineChart
            data={userGrowthData}
            lines={[
              {
                dataKey: 'users',
                stroke: '#3b82f6',
                name: 'Total Users',
              },
              {
                dataKey: 'newUsers',
                stroke: '#10b981',
                name: 'New Users',
              },
            ]}
            height={300}
          />
        </div>

        {/* Project Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Project Distribution
            </h2>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              View Details
            </button>
          </div>
          <PieChart
            data={projectTypeDistribution}
            height={300}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444']}
          />
        </div>
      </div>

      {/* Revenue and Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue by Service Type */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Revenue by Service Type
            </h2>
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded-full">
              +23.5% vs last period
            </span>
          </div>
          <BarChart
            data={revenueByService}
            bars={[
              {
                dataKey: 'revenue',
                fill: '#3b82f6',
                name: 'Revenue ($)',
              },
            ]}
            height={300}
            xAxisDataKey="service"
            format={(value) => formatCurrency(value)}
            layout="horizontal"
          />
        </div>

        {/* Quality Trends */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quality Trends
            </h2>
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded-full">
              Above target
            </span>
          </div>
          <LineChart
            data={qualityTrends}
            lines={[
              {
                dataKey: 'accuracy',
                stroke: '#10b981',
                name: 'Accuracy (%)',
              },
              {
                dataKey: 'disputes',
                stroke: '#ef4444',
                name: 'Disputes',
              },
            ]}
            height={300}
          />
        </div>
      </div>

      {/* Top Countries */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top Countries by Users
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            {topCountries.map((country, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {country.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {country.users.toLocaleString()} users
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{ width: `${country.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-white w-12 text-right">
                    {country.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Enterprise Analytics Section */}
      <div className="mt-8">
        <EnterpriseAnalytics
          enterpriseMetrics={enterpriseMetrics}
          workflowMetrics={workflowMetrics}
          integrationMetrics={integrationMetrics}
          complianceMetrics={complianceMetrics}
          isLoading={enterpriseLoading || workflowLoading || integrationLoading || complianceLoading}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            User Analytics Report
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Comprehensive user behavior and demographics analysis.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleGenerateReport('user-analytics')}
          >
            Generate Report
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Financial Summary
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Detailed revenue, costs, and profitability analysis.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleGenerateReport('financial-summary')}
          >
            Generate Report
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Performance Metrics
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            System performance and operational efficiency metrics.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleGenerateReport('performance-metrics')}
          >
            Generate Report
          </Button>
        </div>
      </div>
    </div>
  );
}