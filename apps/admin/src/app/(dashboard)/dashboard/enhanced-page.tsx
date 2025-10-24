'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UsersIcon,
  FolderIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Activity,
  TrendingUp,
} from '@heroicons/react/24/outline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KPICard } from '@/components/charts/KPICard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { RealTimeMonitor } from '@/components/monitoring/RealTimeMonitor';
import { dashboardApi } from '@/lib/api';
import { DashboardMetrics } from '@/types';
import { ErrorBoundary } from '@labelmint/ui';

export default function EnhancedDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: metrics, isLoading, error, refetch } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics'],
    queryFn: dashboardApi.getMetrics,
    refetchInterval: 30000,
  });

  const revenueData = [
    { date: 'Jan', revenue: 4000, transactions: 240 },
    { date: 'Feb', revenue: 3000, transactions: 180 },
    { date: 'Mar', revenue: 5000, transactions: 320 },
    { date: 'Apr', revenue: 4500, transactions: 280 },
    { date: 'May', revenue: 6000, transactions: 390 },
    { date: 'Jun', revenue: 5500, transactions: 350 },
  ];

  const projectTypeData = [
    { name: 'Image Classification', value: 450 },
    { name: 'Text Annotation', value: 320 },
    { name: 'Data Validation', value: 280 },
    { name: 'Audio Transcription', value: 150 },
  ];

  const userActivityData = [
    { time: '00:00', active: 120 },
    { time: '04:00', active: 80 },
    { time: '08:00', active: 340 },
    { time: '12:00', active: 520 },
    { time: '16:00', active: 480 },
    { time: '20:00', active: 290 },
  ];

  if (error) {
    return (
      <ErrorBoundary
        onError={(err) => console.error('Dashboard error:', err)}
        maxRetries={3}
      >
        <div className="p-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">
              Error loading dashboard data. Please try again later.
            </p>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Comprehensive overview of LabelMint platform
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <ChartBarIcon className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Real-time
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard
                title="Total Users"
                value={metrics?.totalUsers?.toLocaleString() || '0'}
                change={12.5}
                changeType="increase"
                icon={<UsersIcon className="h-6 w-6" />}
                description="Active clients and workers"
                loading={isLoading}
              />
              <KPICard
                title="Active Projects"
                value={metrics?.activeProjects?.toLocaleString() || '0'}
                change={8.2}
                changeType="increase"
                icon={<FolderIcon className="h-6 w-6" />}
                description="Projects currently running"
                loading={isLoading}
              />
              <KPICard
                title="Monthly Revenue"
                value={`$${(metrics?.monthlyRevenue || 0).toLocaleString()}`}
                change={23.1}
                changeType="increase"
                icon={<CurrencyDollarIcon className="h-6 w-6" />}
                description="Revenue this month"
                loading={isLoading}
              />
              <KPICard
                title="Completion Rate"
                value={`${(metrics?.avgCompletionRate || 0).toFixed(1)}%`}
                change={2.4}
                changeType="increase"
                icon={<ChartBarIcon className="h-6 w-6" />}
                description="Average task completion"
                loading={isLoading}
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Revenue Trend
                </h2>
                <LineChart
                  data={revenueData}
                  lines={[
                    {
                      dataKey: 'revenue',
                      stroke: '#3b82f6',
                      name: 'Revenue ($)',
                    },
                    {
                      dataKey: 'transactions',
                      stroke: '#10b981',
                      name: 'Transactions',
                    },
                  ]}
                  height={300}
                />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Projects by Type
                </h2>
                <PieChart
                  data={projectTypeData}
                  height={300}
                />
              </div>
            </div>

            {/* User Activity Chart */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                User Activity (24h)
              </h2>
              <BarChart
                data={userActivityData}
                bars={[
                  {
                    dataKey: 'active',
                    fill: '#3b82f6',
                    name: 'Active Users',
                  },
                ]}
                height={300}
                xAxisDataKey="time"
                layout="vertical"
              />
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="monitoring">
            <RealTimeMonitor />
          </TabsContent>

          <TabsContent value="reports">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ReportCard
                  title="User Activity Report"
                  description="Detailed user engagement metrics"
                  icon={<UsersIcon className="h-8 w-8" />}
                />
                <ReportCard
                  title="Financial Summary"
                  description="Revenue and transaction reports"
                  icon={<CurrencyDollarIcon className="h-8 w-8" />}
                />
                <ReportCard
                  title="Project Performance"
                  description="Completion rates and quality metrics"
                  icon={<FolderIcon className="h-8 w-8" />}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}

function ReportCard({ title, description, icon }: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer">
      <div className="text-gray-400 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}