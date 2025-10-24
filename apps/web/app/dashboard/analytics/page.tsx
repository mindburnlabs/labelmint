'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@labelmint/ui';
import { authClient } from '@/lib/auth-client';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

interface AnalyticsData {
  overview: {
    totalTasks: number;
    completedTasks: number;
    totalWorkers: number;
    activeWorkers: number;
    avgAccuracy: number;
    avgTimePerTask: number;
    totalEarnings: number;
  };
  dailyStats: Array<{
    date: string;
    tasks: number;
    accuracy: number;
    workers: number;
    earnings: number;
  }>;
  taskTypeDistribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  workerPerformance: Array<{
    name: string;
    tasks: number;
    accuracy: number;
    earnings: number;
  }>;
  projectMetrics: Array<{
    name: string;
    status: string;
    progress: number;
    budget: number;
    spent: number;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      const user = await authClient.getCurrentUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Mock data - in production, this would be real API calls
      const mockData: AnalyticsData = {
        overview: {
          totalTasks: 45680,
          completedTasks: 42350,
          totalWorkers: 3240,
          activeWorkers: 892,
          avgAccuracy: 94.2,
          avgTimePerTask: 12.5,
          totalEarnings: 45680.50,
        },
        dailyStats: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          tasks: Math.floor(Math.random() * 500) + 1000,
          accuracy: 92 + Math.random() * 6,
          workers: Math.floor(Math.random() * 200) + 700,
          earnings: Math.random() * 1000 + 1500,
        })),
        taskTypeDistribution: [
          { type: 'Image Classification', count: 18272, percentage: 40 },
          { type: 'Text Classification', count: 13672, percentage: 30 },
          { type: 'RLHF Pair', count: 9136, percentage: 20 },
          { type: 'Bounding Box', count: 4568, percentage: 10 },
        ],
        workerPerformance: Array.from({ length: 10 }, (_, i) => ({
          name: `Worker ${i + 1}`,
          tasks: Math.floor(Math.random() * 500) + 100,
          accuracy: 90 + Math.random() * 8,
          earnings: Math.random() * 500 + 100,
        })).sort((a, b) => b.tasks - a.tasks),
        projectMetrics: [
          { name: 'Project Alpha', status: 'Running', progress: 75, budget: 5000, spent: 3750 },
          { name: 'Project Beta', status: 'Complete', progress: 100, budget: 3000, spent: 2950 },
          { name: 'Project Gamma', status: 'Running', progress: 45, budget: 8000, spent: 3600 },
          { name: 'Project Delta', status: 'Paused', progress: 30, budget: 2000, spent: 600 },
          { name: 'Project Epsilon', status: 'Complete', progress: 100, budget: 1500, spent: 1485 },
        ],
      };

      setData(mockData);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const handleExport = () => {
    if (!data) return;

    const csvContent = [
      ['Metric', 'Value'],
      ['Total Tasks', data.overview.totalTasks],
      ['Completed Tasks', data.overview.completedTasks],
      ['Total Workers', data.overview.totalWorkers],
      ['Active Workers', data.overview.activeWorkers],
      ['Average Accuracy', `${data.overview.avgAccuracy}%`],
      ['Average Time/Task', `${data.overview.avgTimePerTask}s`],
      ['Total Earnings', `$${data.overview.totalEarnings.toFixed(2)}`],
    ].map(row => row.join(','));

    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Analytics exported successfully');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-primary">
                LabelMint
              </Link>
              <span className="ml-4 text-sm text-gray-500">Analytics</span>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
              <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {data.overview.totalTasks.toLocaleString()}
                </p>
                <div className="flex items-center text-xs text-green-600 dark:text-green-400 mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +12.5%
                </div>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Completion Rate</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {((data.overview.completedTasks / data.overview.totalTasks) * 100).toFixed(1)}%
                </p>
                <div className="flex items-center text-xs text-green-600 dark:text-green-400 mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +3.2%
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Workers</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {data.overview.activeWorkers.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  of {data.overview.totalWorkers.toLocaleString()} total
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Accuracy</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {data.overview.avgAccuracy}%
                </p>
                <div className="flex items-center text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  -0.5%
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-yellow-500" />
            </div>
          </motion.div>

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
              Task Volume & Accuracy
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="tasks"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Tasks"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Accuracy %"
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Task Type Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Task Type Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={data.taskTypeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.taskTypeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {data.taskTypeDistribution.map((item, index) => (
                <div key={item.type} className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-700 dark:text-gray-300">{item.type}</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {item.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Worker Performance & Project Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Workers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Top Performers
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Worker
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Tasks
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Accuracy
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Earnings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.workerPerformance.slice(0, 5).map((worker, index) => (
                    <tr key={worker.name} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 text-sm text-gray-900 dark:text-white">
                        {worker.name}
                      </td>
                      <td className="text-right py-2 text-sm text-gray-900 dark:text-white">
                        {worker.tasks}
                      </td>
                      <td className="text-right py-2 text-sm text-gray-900 dark:text-white">
                        {worker.accuracy.toFixed(1)}%
                      </td>
                      <td className="text-right py-2 text-sm text-gray-900 dark:text-white">
                        ${worker.earnings.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Project Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Project Metrics
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.projectMetrics} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="progress" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {data.projectMetrics.slice(0, 5).map((project) => (
                <div key={project.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${
                        project.status === 'Complete'
                          ? 'bg-green-500'
                          : project.status === 'Running'
                          ? 'bg-blue-500'
                          : project.status === 'Paused'
                          ? 'bg-yellow-500'
                          : 'bg-gray-500'
                      }`}
                    />
                    <span className="text-gray-700 dark:text-gray-300">{project.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${project.spent} / ${project.budget}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Additional Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Time/Task</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.overview.avgTimePerTask}s
                </p>
              </div>
              <Clock className="h-8 w-8 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${data.overview.totalEarnings.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Worker Retention</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  87.3%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}