'use client';

// Fixed heroicons and import issues - trigger recompile

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
  BoltIcon, // replaced ZapIcon
  ShieldCheckIcon,
  ServerIcon, // replaced DatabaseIcon
  ArrowPathIcon, // replaced ActivityIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../../lib/auth';
import { GlassKPICard } from '../../../components/ui/GlassKPICard';
import { GlassCard } from '../../../components/ui/GlassCard';
import { GlassButton } from '../../../components/ui/GlassButton';
import { LineChart } from '../../../components/charts/LineChart';
import { BarChart } from '../../../components/charts/BarChart';
import { PieChart } from '../../../components/charts/PieChart';
import { dashboardApi } from '../../../lib/api';
import { DashboardMetrics } from '../../../types/index';
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
    <div className="space-y-8">
      {/* Premium Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 animate-slide-in">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
            Welcome back, <span className="font-semibold text-gray-900 dark:text-white">{user?.profile.firstName}</span>! Here's your real-time platform overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GlassButton variant="secondary" className="hover:scale-105 transition-transform duration-200">
            📊 Export Report
          </GlassButton>
          <GlassButton className="hover:scale-105 transition-transform duration-200">
            📈 View Analytics
          </GlassButton>
        </div>
      </div>

      {/* Enhanced KPI Cards with staggered animation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassKPICard
          title="Total Users"
          value={metrics?.totalUsers || 0}
          change={12.5}
          changeType="increase"
          changeLabel="from last month"
          icon={UsersIcon}
          description="Active clients and workers worldwide"
          gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          className="animate-stagger-1 hover:scale-105 transition-transform duration-300"
        />

        <GlassKPICard
          title="Active Projects"
          value={metrics?.activeProjects || 0}
          change={8.2}
          changeType="increase"
          changeLabel="from last month"
          icon={FolderIcon}
          description="Projects currently in progress"
          gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
          className="animate-stagger-2 hover:scale-105 transition-transform duration-300"
        />

        <GlassKPICard
          title="Monthly Revenue"
          value={metrics?.monthlyRevenue || 0}
          change={23.1}
          changeType="increase"
          changeLabel="from last month"
          icon={CurrencyDollarIcon}
          description="Total revenue generated this month"
          gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
          className="animate-stagger-3 hover:scale-105 transition-transform duration-300"
        />

        <GlassKPICard
          title="Completion Rate"
          value={metrics?.avgCompletionRate || 0}
          change={2.4}
          changeType="increase"
          changeLabel="improvement"
          icon={CheckCircleIcon}
          description="Average task completion rate"
          gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
          className="animate-stagger-4 hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Premium System Health Dashboard */}
      <GlassCard className="p-8 animate-stagger-5">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <ShieldCheckIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                System Health
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Real-time platform monitoring</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-bold glass-badge animate-pulse-slow ${
            systemHealth?.status === 'healthy'
              ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30'
              : systemHealth?.status === 'warning'
              ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30'
              : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
          }`}>
            {systemHealth?.status === 'healthy' ? '✨ All Systems Optimal' :
             systemHealth?.status === 'warning' ? '⚠️ Attention Required' :
             '🚨 Critical Issues'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Uptime Metric */}
          <div className="text-center group">
            <div className="relative inline-flex items-center justify-center">
              <div className="h-20 w-20 rounded-full border-4 border-gray-200 dark:border-gray-700 group-hover:border-green-500/30 transition-colors duration-300"></div>
              <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-white text-sm font-bold">99.9%</span>
              </div>
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-900 dark:text-white">Uptime</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Last 30 days</p>
            <div className="mt-2 flex justify-center">
              <span className="glass-badge text-xs bg-green-500/20 text-green-600 dark:text-green-400">Excellent</span>
            </div>
          </div>

          {/* API Latency */}
          <div className="text-center group">
            <div className="mx-auto h-20 w-20 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <div className="text-center">
                <span className="text-white text-xl font-bold">
                  {systemHealth?.apiLatency || 0}
                </span>
                <span className="text-white/80 text-xs block">ms</span>
              </div>
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-900 dark:text-white">API Latency</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Average response time</p>
            <div className="mt-2 flex justify-center">
              <span className="glass-badge text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400">Fast</span>
            </div>
          </div>

          {/* Database Connections */}
          <div className="text-center group">
            <div className="mx-auto h-20 w-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300">
              <ServerIcon className="h-8 w-8 text-white" />
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-900 dark:text-white">DB Connections</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active connections</p>
            <div className="mt-2 flex justify-center">
              <span className="glass-badge text-xs bg-purple-500/20 text-purple-600 dark:text-purple-400">
                {systemHealth?.databaseConnections || 0} active
              </span>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="text-center group">
            <div className="mx-auto h-20 w-20 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-all duration-300">
              <BoltIcon className="h-8 w-8 text-white" />
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-900 dark:text-white">Memory Usage</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Of 8GB total</p>
            <div className="mt-2 flex justify-center">
              <span className="glass-badge text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">1.2GB</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Premium Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enhanced Revenue Trend Chart */}
        <GlassCard className="p-6 hover:scale-[1.02] transition-transform duration-300 animate-slide-in-up">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <ChartBarIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Revenue Trend
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">Monthly performance overview</p>
              </div>
            </div>
            <select className="glass-nav-item text-sm font-medium px-4 py-2 rounded-xl">
              <option>Last 6 months</option>
              <option>Last year</option>
              <option>All time</option>
            </select>
          </div>
          <div className="h-80">
            <LineChart
              data={revenueData}
              lines={[
                {
                  dataKey: 'revenue',
                  stroke: '#667eea',
                  name: 'Revenue ($)',
                },
                {
                  dataKey: 'transactions',
                  stroke: '#4facfe',
                  name: 'Transactions',
                },
              ]}
              height={320}
              format={(value) => `$${value}`}
            />
          </div>
        </GlassCard>

        {/* Enhanced Projects by Type Chart */}
        <GlassCard className="p-6 hover:scale-[1.02] transition-transform duration-300 animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <FolderIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Projects by Type
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">Distribution across categories</p>
              </div>
            </div>
            <GlassButton variant="secondary" className="text-sm hover:scale-105 transition-transform duration-200">
              View All
            </GlassButton>
          </div>
          <div className="h-80">
            <PieChart
              data={projectTypeData}
              height={320}
              format={(value) => value.toString()}
            />
          </div>
        </GlassCard>
      </div>

      {/* Enhanced User Activity Chart */}
      <GlassCard className="p-6 mb-8 hover:scale-[1.01] transition-transform duration-300 animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <ArrowPathIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                User Activity (24h)
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">Real-time engagement metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="glass-badge text-xs bg-green-500/20 text-green-600 dark:text-green-400 font-medium">
                🔴 Live
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Updates every 5 min</span>
          </div>
        </div>
        <div className="h-80">
          <BarChart
            data={userActivityData}
            bars={[
              {
                dataKey: 'active',
                fill: '#4facfe',
                name: 'Active Users',
              },
            ]}
            height={320}
            xAxisDataKey="time"
            layout="vertical"
          />
        </div>
      </GlassCard>

      {/* Premium Recent Activity */}
      <GlassCard className="overflow-hidden animate-slide-in-up" style={{ animationDelay: '0.3s' }}>
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-500/5 to-purple-600/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <ClockIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Recent Activity
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Live platform events and updates</p>
              </div>
            </div>
            <GlassButton variant="secondary" className="hover:scale-105 transition-transform duration-200">
              View All Activity
            </GlassButton>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {/* Activity Item 1 */}
          <div className="p-6 hover:bg-white/5 transition-all duration-300 group/item">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover/item:scale-110 group-hover/item:rotate-3 transition-all duration-300">
                  <UsersIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 dark:text-white group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors duration-200">
                    New user registration
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    John Doe joined as a worker
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="glass-badge text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 font-medium">
                      👤 User
                    </span>
                    <span className="glass-badge text-xs bg-gray-500/20 text-gray-600 dark:text-gray-400">
                      ID: #USR-2847
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">2 minutes ago</p>
                <GlassButton variant="secondary" className="mt-2 text-xs hover:scale-105 transition-transform duration-200">
                  View Details
                </GlassButton>
              </div>
            </div>
          </div>

          {/* Activity Item 2 */}
          <div className="p-6 hover:bg-white/5 transition-all duration-300 group/item">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover/item:scale-110 group-hover/item:rotate-3 transition-all duration-300">
                  <CheckCircleIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 dark:text-white group-hover/item:text-green-600 dark:group-hover/item:text-green-400 transition-colors duration-200">
                    Project completed
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Image Classification for Acme Corp
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="glass-badge text-xs bg-green-500/20 text-green-600 dark:text-green-400 font-medium">
                      ✅ Project
                    </span>
                    <span className="glass-badge text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400">
                      1,250 tasks
                    </span>
                    <span className="glass-badge text-xs bg-purple-500/20 text-purple-600 dark:text-purple-400">
                      $2,500 earned
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">5 minutes ago</p>
                <GlassButton variant="secondary" className="mt-2 text-xs hover:scale-105 transition-transform duration-200">
                  View Details
                </GlassButton>
              </div>
            </div>
          </div>

          {/* Activity Item 3 */}
          <div className="p-6 hover:bg-white/5 transition-all duration-300 group/item">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="h-12 w-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover/item:scale-110 group-hover/item:rotate-3 transition-all duration-300">
                  <ExclamationTriangleIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 dark:text-white group-hover/item:text-yellow-600 dark:group-hover/item:text-yellow-400 transition-colors duration-200">
                    Dispute opened
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Quality issue reported in Project #1234
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="glass-badge text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-medium">
                      ⚠️ Dispute
                    </span>
                    <span className="glass-badge text-xs bg-red-500/20 text-red-600 dark:text-red-400">
                      High Priority
                    </span>
                    <span className="glass-badge text-xs bg-gray-500/20 text-gray-600 dark:text-gray-400">
                      Admin Team
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">10 minutes ago</p>
                <GlassButton className="mt-2 text-xs hover:scale-105 transition-transform duration-200">
                  Review Now
                </GlassButton>
              </div>
            </div>
          </div>

          {/* Activity Item 4 */}
          <div className="p-6 hover:bg-white/5 transition-all duration-300 group/item">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover/item:scale-110 group-hover/item:rotate-3 transition-all duration-300">
                  <CurrencyDollarIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 dark:text-white group-hover/item:text-purple-600 dark:group-hover/item:text-purple-400 transition-colors duration-200">
                    Payment processed
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Withdrawal request from Sarah Johnson
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="glass-badge text-xs bg-purple-500/20 text-purple-600 dark:text-purple-400 font-medium">
                      💳 Payment
                    </span>
                    <span className="glass-badge text-xs bg-green-500/20 text-green-600 dark:text-green-400">
                      $750.00
                    </span>
                    <span className="glass-badge text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400">
                      Bank Transfer
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">15 minutes ago</p>
                <GlassButton variant="secondary" className="mt-2 text-xs hover:scale-105 transition-transform duration-200">
                  View Details
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}