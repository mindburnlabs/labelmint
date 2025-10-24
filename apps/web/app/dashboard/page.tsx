'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, ErrorBoundary } from '@labelmint/ui';
import { authClient } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import { useDashboardUpdates } from '@/hooks/use-websocket';
import { StatsCardSkeleton, ProjectCardSkeleton } from '@/components/ui/loading-skeleton';
import { formatCurrency, formatDate, formatRelativeTime, calculatePercentage, statusColors } from '@/lib/utils';
import {
  PlusCircle,
  FileText,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Wifi,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedTasks: number;
  totalSpent: number;
  accuracy: number;
  avgTimePerTask: number;
}

interface RecentProject {
  id: string;
  title: string;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'DONE';
  progress: number;
  createdAt: string;
  tasksCompleted: number;
  totalTasks: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // WebSocket for real-time updates
  const { isConnected, dashboardStats } = useDashboardUpdates();

  useEffect(() => {
    loadDashboard();
  }, []);

  // Update stats when WebSocket data comes in
  useEffect(() => {
    if (dashboardStats) {
      setStats(dashboardStats);
    }
  }, [dashboardStats]);

  const loadDashboard = async () => {
    try {
      // Get current user
      const currentUser = await authClient.getCurrentUser();
      if (!currentUser) {
        router.push('/auth/login');
        return;
      }
      setUser(currentUser);

      // Load dashboard data
      const [statsData, projectsData] = await Promise.all([
        apiClient.getDashboardStats(currentUser.id),
        apiClient.getRecentProjects(currentUser.id),
      ]);

      setStats(statsData);
      setRecentProjects(projectsData);
    } catch (error: any) {
      toast.error('Failed to load dashboard');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await authClient.logout();
    toast.success('Logged out successfully');
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header skeleton */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar skeleton */}
          <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm min-h-screen">
            <nav className="mt-5 px-2 space-y-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              ))}
            </nav>
          </aside>

          {/* Main content skeleton */}
          <main className="flex-1 p-6">
            <div className="mb-8">
              <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="h-5 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>

            {/* Stats skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <StatsCardSkeleton key={i} />
              ))}
            </div>

            {/* Recent projects skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              <div className="p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ProjectCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Dashboard error:', error, errorInfo);
        toast.error('Something went wrong loading the dashboard');
      }}
      maxRetries={3}
      retryDelay={2000}
    >
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-primary">
                LabelMint
              </Link>
              <span className="ml-4 text-sm text-gray-500">Client Dashboard</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <AnimatePresence>
                  {isConnected ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="flex items-center"
                    >
                      <Wifi className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-xs text-green-500">Live</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="flex items-center"
                    >
                      <WifiOff className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-xs text-gray-400">Offline</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Welcome, {user?.firstName}!
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm min-h-screen">
          <nav className="mt-5 px-2">
            <Link
              href="/dashboard"
              className="group flex items-center px-2 py-2 text-sm font-medium rounded-md bg-primary/10 text-primary"
            >
              <BarChart3 className="mr-3 h-5 w-5" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/projects"
              className="mt-1 group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <FileText className="mr-3 h-5 w-5" />
              Projects
            </Link>
            <Link
              href="/dashboard/tasks"
              className="mt-1 group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <CheckCircle className="mr-3 h-5 w-5" />
              Tasks
            </Link>
            <Link
              href="/dashboard/analytics"
              className="mt-1 group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <TrendingUp className="mr-3 h-5 w-5" />
              Analytics
            </Link>
            <Link
              href="/dashboard/billing"
              className="mt-1 group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <DollarSign className="mr-3 h-5 w-5" />
              Billing
            </Link>
            <Link
              href="/dashboard/settings"
              className="mt-1 group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Settings className="mr-3 h-5 w-5" />
              Settings
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Overview of your labeling projects and performance
            </p>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <Link href="/dashboard/projects/create">
              <Button size="lg" className="shadow-lg">
                <PlusCircle className="h-5 w-5 mr-2" />
                Create New Project
              </Button>
            </Link>
          </div>

          {/* Stats Grid */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Projects</p>
                    <motion.p
                      key={stats.totalProjects}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl font-semibold text-gray-900 dark:text-white"
                    >
                      {stats.totalProjects}
                    </motion.p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                    <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-300" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Projects</p>
                    <motion.p
                      key={stats.activeProjects}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl font-semibold text-gray-900 dark:text-white"
                    >
                      {stats.activeProjects}
                    </motion.p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                    <CheckCircle className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Completed Tasks</p>
                    <motion.p
                      key={stats.completedTasks}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl font-semibold text-gray-900 dark:text-white"
                    >
                      {stats.completedTasks.toLocaleString()}
                    </motion.p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                    <DollarSign className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                    <motion.p
                      key={stats.totalSpent}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl font-semibold text-gray-900 dark:text-white"
                    >
                      {formatCurrency(stats.totalSpent)}
                    </motion.p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Recent Projects */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Projects
              </h2>
            </div>
            <div className="p-6">
              {recentProjects.length > 0 ? (
                <div className="space-y-4">
                  {recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {project.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {project.tasksCompleted} / {project.totalTasks} tasks completed
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[project.status]}`}
                          >
                            {project.status}
                          </span>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {calculatePercentage(project.tasksCompleted, project.totalTasks)}% complete
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <motion.div
                            className="bg-primary h-2 rounded-full transition-all"
                            initial={{ width: 0 }}
                            animate={{ width: `${calculatePercentage(project.tasksCompleted, project.totalTasks)}%` }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                          ></motion.div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No projects yet
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Get started by creating your first labeling project.
                  </p>
                  <div className="mt-6">
                    <Link href="/dashboard/projects/create">
                      <Button>Create Project</Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
    </ErrorBoundary>
  );
}