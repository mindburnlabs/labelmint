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
  TrendingUpIcon,
  TrendingDownIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth';
import { KPICard } from '@/components/charts/KPICard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { dashboardApi } from '@/lib/api';
import { DashboardMetrics } from '@/types';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuth();
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
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Welcome back, {user?.profile.firstName}! Here's what's happening today.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Export Report
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              View Analytics
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {metrics?.totalUsers?.toLocaleString() || '0'}
              </p>
              <div className="flex items-center mt-2">
                <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">12.5%</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">from last month</span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <UsersIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Active clients and workers</p>
        </div>

        {/* Active Projects Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {metrics?.activeProjects?.toLocaleString() || '0'}
              </p>
              <div className="flex items-center mt-2">
                <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">8.2%</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">from last month</span>
              </div>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <FolderIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Projects currently running</p>
        </div>

        {/* Monthly Revenue Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ${(metrics?.monthlyRevenue || 0).toLocaleString()}
              </p>
              <div className="flex items-center mt-2">
                <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">23.1%</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">from last month</span>
              </div>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Revenue this month</p>
        </div>

        {/* Completion Rate Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completion Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {(metrics?.avgCompletionRate || 0).toFixed(1)}%
              </p>
              <div className="flex items-center mt-2">
                <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">2.4%</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">improvement</span>
              </div>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Average task completion</p>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            System Health
          </h2>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            systemHealth?.status === 'healthy'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : systemHealth?.status === 'warning'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {systemHealth?.status || 'Checking...'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center">
              <div className="h-16 w-16 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-2 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">99.9%</span>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">Uptime</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Last 30 days</p>
          </div>

          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-lg font-bold">
                {systemHealth?.apiLatency || 0}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">API Latency</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Average response time</p>
          </div>

          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
              <span className="text-purple-600 dark:text-purple-400 text-lg font-bold">
                {systemHealth?.databaseConnections || 0}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">DB Connections</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active connections</p>
          </div>

          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 dark:text-yellow-400 text-lg font-bold">
                1.2GB
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">Memory Usage</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Of 8GB total</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Trend Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Revenue Trend
            </h2>
            <select className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <option>Last 6 months</option>
              <option>Last year</option>
              <option>All time</option>
            </select>
          </div>
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

        {/* Projects by Type Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Projects by Type
            </h2>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              View All
            </button>
          </div>
          <PieChart
            data={projectTypeData}
            height={300}
            format={(value) => value.toString()}
          />
        </div>
      </div>

      {/* User Activity Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            User Activity (24h)
          </h2>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
              Live
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Updates every 5 min</span>
          </div>
        </div>
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
      <div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h2>
              <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                View All Activity
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            <div className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <UsersIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      New user registration
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      John Doe joined as a worker
                    </p>
                    <div className="flex items-center mt-2 space-x-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        User
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ID: #USR-2847
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">2 minutes ago</p>
                  <button className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                    View Details
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="h-10 w-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Project completed
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Image Classification for Acme Corp
                    </p>
                    <div className="flex items-center mt-2 space-x-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Project
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        1,250 tasks completed
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        $2,500 earned
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">5 minutes ago</p>
                  <button className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                    View Details
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="h-10 w-10 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Dispute opened
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Quality issue reported in Project #1234
                    </p>
                    <div className="flex items-center mt-2 space-x-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                        Dispute
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Priority: High
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Assigned to: Admin Team
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">10 minutes ago</p>
                  <button className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                    Review Now
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <CurrencyDollarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Payment processed
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Withdrawal request from Sarah Johnson
                    </p>
                    <div className="flex items-center mt-2 space-x-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                        Payment
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Amount: $750.00
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Method: Bank Transfer
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">15 minutes ago</p>
                  <button className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}