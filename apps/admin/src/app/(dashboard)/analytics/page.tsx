'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { analyticsApi } from '@/lib/api';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { KPICard } from '@/components/charts/KPICard';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import {
  UsersIcon,
  FolderIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d');

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview', dateRange],
    queryFn: () => analyticsApi.getOverview(dateRange),
  });

  const { data: userMetrics, isLoading: userLoading } = useQuery({
    queryKey: ['analytics-users', dateRange],
    queryFn: () => analyticsApi.getUserMetrics(dateRange),
  });

  const { data: projectMetrics, isLoading: projectLoading } = useQuery({
    queryKey: ['analytics-projects', dateRange],
    queryFn: () => analyticsApi.getProjectMetrics(dateRange),
  });

  const { data: financialMetrics, isLoading: financialLoading } = useQuery({
    queryKey: ['analytics-financial', dateRange],
    queryFn: () => analyticsApi.getFinancialMetrics(dateRange),
  });

  const { data: qualityMetrics, isLoading: qualityLoading } = useQuery({
    queryKey: ['analytics-quality', dateRange],
    queryFn: () => analyticsApi.getQualityMetrics(dateRange),
  });

  const userGrowthData = [
    { date: 'Jan', users: 240, newUsers: 45 },
    { date: 'Feb', users: 280, newUsers: 40 },
    { date: 'Mar', users: 320, newUsers: 40 },
    { date: 'Apr', users: 380, newUsers: 60 },
    { date: 'May', users: 450, newUsers: 70 },
    { date: 'Jun', users: 520, newUsers: 70 },
  ];

  const projectTypeDistribution = [
    { name: 'Image Classification', value: 45 },
    { name: 'Text Annotation', value: 30 },
    { name: 'Data Validation', value: 15 },
    { name: 'Audio Transcription', value: 10 },
  ];

  const topCountries = [
    { name: 'United States', users: 450, percentage: 35 },
    { name: 'India', users: 280, percentage: 22 },
    { name: 'Philippines', users: 180, percentage: 14 },
    { name: 'United Kingdom', users: 120, percentage: 9 },
    { name: 'Canada', users: 100, percentage: 8 },
  ];

  const qualityTrends = [
    { date: 'Week 1', accuracy: 94.2, disputes: 12 },
    { date: 'Week 2', accuracy: 94.5, disputes: 10 },
    { date: 'Week 3', accuracy: 95.1, disputes: 8 },
    { date: 'Week 4', accuracy: 95.8, disputes: 6 },
  ];

  const revenueByService = [
    { service: 'Image Classification', revenue: 45000 },
    { service: 'Text Annotation', revenue: 32000 },
    { service: 'Data Validation', revenue: 28000 },
    { service: 'Audio Transcription', revenue: 15000 },
  ];

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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Analytics & Reports
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Business intelligence and performance insights.
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 3 months</option>
              <option value="365d">Last year</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => handleExportData('analytics', 'csv')}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => handleGenerateReport('full-report')}
            >
              <DocumentTextIcon className="h-4 w-4" />
              Generate Report
            </Button>
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
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            User Growth Trend
          </h2>
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

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Project Distribution
          </h2>
          <PieChart
            data={projectTypeDistribution}
            height={300}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444']}
          />
        </div>
      </div>

      {/* Revenue and Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue by Service Type
          </h2>
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

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quality Trends
          </h2>
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