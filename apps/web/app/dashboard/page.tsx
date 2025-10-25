'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  Users,
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  Globe,
  Activity,
  Database,
  DollarSign,
  Eye,
  Plus,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  ChevronRight,
  Settings,
  Search,
  Bell,
  Wifi,
  WifiOff,
  Target,
  TrendingDown,
  AlertTriangle,
  Shield
} from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { DataTable } from '@/components/ui/data-table'
import { StatusCell, CurrencyCell, DateCell } from '@/components/ui/data-table'
import { WebSocketProvider, useWebSocket } from '@/hooks/useWebSocket'
import { AnimatedMetricCard, InteractiveLineChart, InteractiveAreaChart, InteractiveBarChart, RealTimeChart } from '@/components/ui/advanced-charts'
import { AdvancedSearch } from '@/components/ui/advanced-search'
import { ConnectionStatusToast, LiveActivityToast } from '@/components/ui/advanced-toast'
import { PerformanceMonitor } from '@/components/ui/performance-monitor'
import { SecurityDashboard } from '@/components/ui/security-dashboard'

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

function DashboardContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'security'>('overview');

  // WebSocket for real-time updates
  const { isConnected, dashboardStats, notifications, recentActivity } = useWebSocket();

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
      // Simulate loading dashboard data
      const mockStats: DashboardStats = {
        totalProjects: 42,
        activeProjects: 8,
        completedTasks: 15420,
        totalSpent: 125430,
        accuracy: 99.5,
        avgTimePerTask: 45
      };

      const mockProjects: RecentProject[] = [
        {
          id: '1',
          title: 'Image Classification for E-commerce',
          status: 'RUNNING',
          progress: 75,
          createdAt: '2024-01-15',
          tasksCompleted: 750,
          totalTasks: 1000
        },
        {
          id: '2',
          title: 'Sentiment Analysis Dataset',
          status: 'RUNNING',
          progress: 60,
          createdAt: '2024-01-10',
          tasksCompleted: 600,
          totalTasks: 1000
        },
        {
          id: '3',
          title: 'Object Detection - Autonomous Vehicles',
          status: 'PAUSED',
          progress: 45,
          createdAt: '2024-01-05',
          tasksCompleted: 450,
          totalTasks: 1000
        }
      ];

      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      setStats(mockStats);
      setRecentProjects(mockProjects);
      setUser({ name: 'John Doe', email: 'john@example.com' });
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate sample data for charts
  const generateTimeSeriesData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        time: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed: Math.floor(Math.random() * 500) + 100,
        accuracy: Math.random() * 5 + 95,
        activeUsers: Math.floor(Math.random() * 50) + 20,
        revenue: Math.floor(Math.random() * 5000) + 2000
      });
    }
    return data;
  };

  const chartData = generateTimeSeriesData();

  if (isLoading) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Loading your workspace...">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-1/2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Advanced Dashboard"
      subtitle="Real-time monitoring and insights"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Button>
        </div>
      }
    >
      {/* Connection Status */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4"
          >
            <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <WifiOff className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800 dark:text-yellow-200">
                    Connection lost - attempting to reconnect...
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6">
        {(['overview', 'performance', 'security'] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-2"
          >
            {tab === 'overview' && <BarChart3 className="h-4 w-4" />}
            {tab === 'performance' && <Activity className="h-4 w-4" />}
            {tab === 'security' && <Shield className="h-4 w-4" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>

      {/* Advanced Search */}
      <div className="mb-6">
        <AdvancedSearch
          onSearch={(query, filters) => {
            console.log('Search:', query, filters);
          }}
          filterOptions={[
            { id: 'status', label: 'Status', type: 'select', options: [
              { label: 'All', value: '' },
              { label: 'Active', value: 'active' },
              { label: 'Completed', value: 'completed' },
              { label: 'Paused', value: 'paused' }
            ]},
            { id: 'dateRange', label: 'Date Range', type: 'date' },
            { id: 'minAccuracy', label: 'Min Accuracy', type: 'number' },
            { id: 'hasIssues', label: 'Has Issues', type: 'boolean' }
          ]}
          placeholder="Search projects, tasks, or metrics..."
          shortcuts={{
            'Ctrl+K': () => console.log('Focus search'),
            'Ctrl+N': () => console.log('New project')
          }}
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Enhanced Metrics */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <AnimatedMetricCard
                title="Total Projects"
                value={stats.totalProjects}
                change={12}
                changeType="increase"
                icon={<FolderOpen className="h-6 w-6 text-blue-500" />}
                description="↑ 12% from last month"
              />
              <AnimatedMetricCard
                title="Active Projects"
                value={stats.activeProjects}
                change={8}
                changeType="increase"
                icon={<Activity className="h-6 w-6 text-green-500" />}
                description="Currently running"
              />
              <AnimatedMetricCard
                title="Completed Tasks"
                value={stats.completedTasks.toLocaleString()}
                change={25}
                changeType="increase"
                icon={<CheckCircle2 className="h-6 w-6 text-purple-500" />}
                description="↑ 25% productivity"
              />
              <AnimatedMetricCard
                title="Total Spent"
                value={`$${stats.totalSpent.toLocaleString()}`}
                change={15}
                changeType="increase"
                icon={<DollarSign className="h-6 w-6 text-yellow-500" />}
                description="This month"
              />
            </div>
          )}

          {/* Interactive Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InteractiveLineChart
              data={chartData}
              lines={[
                { dataKey: 'completed', color: '#3b82f6', name: 'Tasks Completed' },
                { dataKey: 'activeUsers', color: '#10b981', name: 'Active Users' }
              ]}
              title="Performance Trends"
              description="30-day overview of key metrics"
              showBrush
              onPointClick={(data) => console.log('Clicked:', data)}
            />

            <InteractiveAreaChart
              data={chartData}
              areas={[
                { dataKey: 'revenue', color: '#8b5cf6', name: 'Revenue' },
                { dataKey: 'accuracy', color: '#06b6d4', name: 'Accuracy' }
              ]}
              title="Revenue & Accuracy"
              description="Financial performance and quality metrics"
              stacked={false}
            />
          </div>

          {/* Real-time Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>Active and recently updated projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentProjects.map((project) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{project.title}</h3>
                        <Badge variant={project.status === 'RUNNING' ? 'default' : 'secondary'}>
                          {project.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                        <span>{project.tasksCompleted} / {project.totalTasks} tasks</span>
                        <span>{Math.round((project.tasksCompleted / project.totalTasks) * 100)}%</span>
                      </div>
                      <Progress value={(project.tasksCompleted / project.totalTasks) * 100} className="h-2" />
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Live Activity</CardTitle>
                <CardDescription>Real-time system events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.slice(0, 5).map((activity) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2 text-sm"
                    >
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
                      <div>
                        <p className="font-medium">{activity.userName}</p>
                        <p className="text-muted-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Real-time Chart */}
          <RealTimeChart
            dataKey="activeUsers"
            title="Live Active Users"
            updateInterval={2000}
            height={200}
          />
        </motion.div>
      )}

      {activeTab === 'performance' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PerformanceMonitor />
        </motion.div>
      )}

      {activeTab === 'security' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <SecurityDashboard />
        </motion.div>
      )}
    </DashboardLayout>
  );
}

// Main dashboard component with providers
export default function DashboardPage() {
  return (
    <WebSocketProvider>
      <DashboardContent />
    </WebSocketProvider>
  );
}