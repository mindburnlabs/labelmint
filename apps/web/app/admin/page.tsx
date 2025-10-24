'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@labelmint/ui';
import { authClient } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import {
  Users,
  FileText,
  BarChart3,
  DollarSign,
  Play,
  Pause,
  Ban,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Activity,
  Eye,
  Settings,
  RefreshCw,
  Download
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AdminStats {
  totalUsers: number;
  activeWorkers: number;
  totalProjects: number;
  runningProjects: number;
  dailyTasks: number;
  weeklyTasks: number;
  totalEarnings: number;
  avgAccuracy: number;
}

interface RecentActivity {
  id: string;
  type: 'project' | 'user' | 'payment';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

export default function AdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const currentUser = await authClient.getCurrentUser();
      if (!currentUser || currentUser.role !== 'ADMIN') {
        router.push('/dashboard');
        return;
      }
      setUser(currentUser);
      await loadAdminData();
    } catch (error) {
      router.push('/auth/login');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      // In production, these would be actual admin API calls
      const mockStats: AdminStats = {
        totalUsers: 15420,
        activeWorkers: 3240,
        totalProjects: 856,
        runningProjects: 124,
        dailyTasks: 15420,
        weeklyTasks: 89340,
        totalEarnings: 45680.50,
        avgAccuracy: 94.2,
      };

      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'project',
          message: 'Project "Image Classification v2" completed',
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          status: 'success',
        },
        {
          id: '2',
          type: 'user',
          message: 'Worker @username_123 suspicious activity detected',
          timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
          status: 'warning',
        },
        {
          id: '3',
          type: 'payment',
          message: 'Batch withdrawal of $2,340 processed',
          timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
          status: 'success',
        },
      ];

      setStats(mockStats);
      setRecentActivity(mockActivity);
    } catch (error) {
      toast.error('Failed to load admin data');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const taskData = [
    { name: 'Mon', tasks: 12500 },
    { name: 'Tue', tasks: 13800 },
    { name: 'Wed', tasks: 14200 },
    { name: 'Thu', tasks: 15100 },
    { name: 'Fri', tasks: 16800 },
    { name: 'Sat', tasks: 15420 },
    { name: 'Sun', tasks: 14300 },
  ];

  const workerData = [
    { name: 'Active', value: 3240, color: '#10b981' },
    { name: 'Idle', value: 8560, color: '#f59e0b' },
    { name: 'Offline', value: 3620, color: '#6b7280' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-primary">
                LabelMint
              </Link>
              <span className="ml-4 text-sm text-gray-500">Admin Console</span>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Exit Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Alert Banner */}
        {stats && stats.avgAccuracy < 90 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8"
          >
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-800 dark:text-red-300 font-medium">
                Average accuracy below 90%. Consider quality interventions.
              </span>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.totalUsers.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    +{Math.floor(stats.totalUsers * 0.05)} this week
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Workers</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.activeWorkers.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {Math.round((stats.activeWorkers / stats.totalUsers) * 100)}% of total
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Running Projects</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.runningProjects}
                  </p>
                  <p className="text-xs text-gray-500">
                    of {stats.totalProjects} total
                  </p>
                </div>
                <FileText className="h-8 w-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Accuracy</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.avgAccuracy}%
                  </p>
                  <p className={`text-xs ${
                    stats.avgAccuracy >= 95 ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {stats.avgAccuracy >= 95 ? 'Excellent' : 'Good'}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Task Volume Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Weekly Task Volume
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={taskData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="tasks"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Worker Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Worker Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={workerData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {workerData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {workerData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow"
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start space-x-3 pb-4 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div className={`p-2 rounded-full ${
                      activity.status === 'success'
                        ? 'bg-green-100 dark:bg-green-900'
                        : activity.status === 'warning'
                        ? 'bg-yellow-100 dark:bg-yellow-900'
                        : 'bg-red-100 dark:bg-red-900'
                    }`}>
                      {activity.status === 'success' && (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      )}
                      {activity.status === 'warning' && (
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      )}
                      {activity.status === 'error' && (
                        <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="space-y-3">
              <Link href="/admin/projects">
                <Button variant="outline" className="w-full justify-start">
                  <Eye className="h-4 w-4 mr-2" />
                  View All Projects
                </Button>
              </Link>
              <Link href="/admin/users">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              </Link>
              <Link href="/admin/quality">
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Quality Control
                </Button>
              </Link>
              <Link href="/admin/payouts">
                <Button variant="outline" className="w-full justify-start">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Process Payouts
                </Button>
              </Link>
              <Link href="/admin/settings">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  System Settings
                </Button>
              </Link>
              <Button variant="outline" className="w-full justify-start">
                <Download className="h-4 w-4 mr-2" />
                Export Reports
              </Button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}