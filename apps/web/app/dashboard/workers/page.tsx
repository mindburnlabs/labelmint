'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@labelmint/ui';
import { apiClient } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import {
  Users,
  TrendingUp,
  Star,
  Trophy,
  Clock,
  DollarSign,
  Target,
  Award,
  Search,
  Filter,
  Download,
  Eye,
  Mail,
  Shield,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface Worker {
  id: string;
  userId: string;
  user: {
    telegramUsername: string;
    firstName: string;
    email?: string;
  };
  level: number;
  accuracy: number;
  completedTasks: number;
  totalEarnings: number;
  currentStreak: number;
  bestStreak: number;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastActiveAt: string;
  joinedAt: string;
  averageTimeMs: number;
  specialization?: string;
}

interface WorkerStats {
  totalWorkers: number;
  activeWorkers: number;
  newWorkersToday: number;
  averageAccuracy: number;
  totalTasksCompleted: number;
  totalEarnings: number;
  averageEarningsPerWorker: number;
  retentionRate: number;
}

interface PerformanceData {
  date: string;
  tasks: number;
  earnings: number;
  workers: number;
}

export default function WorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const workersPerPage = 20;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [workersRes, statsRes] = await Promise.all([
        apiClient.getWorkers({ limit: 100 }),
        apiClient.getWorkerStats(),
      ]);

      setWorkers(workersRes.data);
      setStats(statsRes);

      // Generate mock performance data
      const mockPerformance = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
        tasks: Math.floor(Math.random() * 500) + 200,
        earnings: Math.random() * 1000 + 500,
        workers: Math.floor(Math.random() * 50) + 100,
      }));
      setPerformanceData(mockPerformance);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load worker data');
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = worker.user.telegramUsername?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         worker.user.firstName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || worker.status === statusFilter;
    const matchesLevel = levelFilter === 'all' ||
                         (levelFilter === 'bronze' && worker.level <= 10) ||
                         (levelFilter === 'silver' && worker.level > 10 && worker.level <= 25) ||
                         (levelFilter === 'gold' && worker.level > 25 && worker.level <= 50) ||
                         (levelFilter === 'platinum' && worker.level > 50);

    return matchesSearch && matchesStatus && matchesLevel;
  });

  const paginatedWorkers = filteredWorkers.slice(
    (currentPage - 1) * workersPerPage,
    currentPage * workersPerPage
  );

  const totalPages = Math.ceil(filteredWorkers.length / workersPerPage);

  const getLevelColor = (level: number) => {
    if (level <= 10) return 'text-bronze-600';
    if (level <= 25) return 'text-gray-500';
    if (level <= 50) return 'text-yellow-600';
    return 'text-purple-600';
  };

  const getLevelLabel = (level: number) => {
    if (level <= 10) return 'Bronze';
    if (level <= 25) return 'Silver';
    if (level <= 50) return 'Gold';
    return 'Platinum';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 bg-green-100';
      case 'INACTIVE': return 'text-gray-600 bg-gray-100';
      case 'SUSPENDED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleExport = async () => {
    try {
      const csv = [
        ['Name', 'Username', 'Level', 'Accuracy', 'Tasks', 'Earnings', 'Status', 'Last Active'],
        ...filteredWorkers.map(w => [
          w.user.firstName,
          w.user.telegramUsername || '',
          w.level,
          `${(w.accuracy * 100).toFixed(1)}%`,
          w.completedTasks,
          `$${w.totalEarnings.toFixed(2)}`,
          w.status,
          new Date(w.lastActiveAt).toLocaleDateString(),
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workers_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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
              <span className="ml-4 text-sm text-gray-500">Workers</span>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Workers</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.totalWorkers.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    +{stats.newWorkersToday} today
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Workers</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.activeWorkers.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {((stats.activeWorkers / stats.totalWorkers) * 100).toFixed(1)}% of total
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Accuracy</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {(stats.averageAccuracy * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Across all workers
                  </p>
                </div>
                <Target className="h-8 w-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Earned</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    ${stats.totalEarnings.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ${stats.averageEarningsPerWorker.toFixed(2)} avg/worker
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Tasks Completed (30 days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="tasks" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

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
              <BarChart data={[
                { level: 'Bronze', count: workers.filter(w => w.level <= 10).length },
                { level: 'Silver', count: workers.filter(w => w.level > 10 && w.level <= 25).length },
                { level: 'Gold', count: workers.filter(w => w.level > 25 && w.level <= 50).length },
                { level: 'Platinum', count: workers.filter(w => w.level > 50).length },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6"
        >
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search workers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                />
              </div>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
            >
              <option value="all">All Levels</option>
              <option value="bronze">Bronze (1-10)</option>
              <option value="silver">Silver (11-25)</option>
              <option value="gold">Gold (26-50)</option>
              <option value="platinum">Platinum (51+)</option>
            </select>
          </div>
        </motion.div>

        {/* Workers Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Worker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Accuracy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tasks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Earnings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedWorkers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {worker.user.firstName[0].toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {worker.user.firstName}
                          </div>
                          <div className="text-sm text-gray-500">
                            @{worker.user.telegramUsername || 'no_username'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Star className={`h-4 w-4 mr-1 ${getLevelColor(worker.level)}`} />
                        <span className={`text-sm font-medium ${getLevelColor(worker.level)}`}>
                          {worker.level}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          {getLevelLabel(worker.level)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {(worker.accuracy * 100).toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {worker.completedTasks.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      ${worker.totalEarnings.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(worker.status)}`}>
                        {worker.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(worker.lastActiveAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedWorker(worker)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {worker.status === 'ACTIVE' ? (
                        <button className="text-red-600 hover:text-red-900">
                          <Shield className="h-4 w-4" />
                        </button>
                      ) : (
                        <button className="text-green-600 hover:text-green-900">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing {((currentPage - 1) * workersPerPage) + 1} to{' '}
              {Math.min(currentPage * workersPerPage, filteredWorkers.length)} of{' '}
              {filteredWorkers.length} workers
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}