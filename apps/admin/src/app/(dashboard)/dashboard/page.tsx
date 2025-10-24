'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UsersIcon,
  FolderIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { KPICard } from '@/components/charts/KPICard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { dashboardApi } from '@/lib/api';
import { DashboardMetrics } from '@/types';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { data: metrics, isLoading, error } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics'],
    queryFn: dashboardApi.getMetrics,
    refetchInterval: 30000, // Refresh every 30 seconds
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

  const systemHealth = metrics?.systemHealth;
  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">
            Error loading dashboard data. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Welcome to the LabelMint Admin Dashboard. Here's what's happening today.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
          icon={<CheckCircleIcon className="h-6 w-6" />}
          description="Average task completion"
          loading={isLoading}
        />
      </div>

      {/* System Health */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          System Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
            <span className={`text-sm font-medium ${getHealthStatusColor(systemHealth?.status || 'warning')}`}>
              {systemHealth?.status || 'Checking...'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">API Latency</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {systemHealth?.apiLatency || 0}ms
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">DB Connections</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {systemHealth?.databaseConnections || 0}/100
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Uptime</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {systemHealth?.uptime ? `${(systemHealth.uptime * 100).toFixed(2)}%` : '0%'}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
            format={(value) => `$${value}`}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Projects by Type
          </h2>
          <PieChart
            data={projectTypeData}
            height={300}
            format={(value) => value.toString()}
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

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <UsersIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      New user registration
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      John Doe joined as a worker
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  2 minutes ago
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Project completed
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Image Classification for Acme Corp
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  5 minutes ago
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                    <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Dispute opened
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Quality issue in Project #1234
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  10 minutes ago
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}